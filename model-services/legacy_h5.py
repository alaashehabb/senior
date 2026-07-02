"""
Loader for legacy Keras 2.x .h5 models on a Keras 3 runtime.

This venv runs Python 3.12, where tensorflow==2.15.x (the version these
models were trained with) cannot be installed. Instead we run standalone
Keras 3 on the PyTorch backend (torch is already required for the WLASL
I3D model), which can execute the same architectures — but Keras 3's
legacy H5 reader trips over a few Keras-2-isms in the stored configs:

  * "dtype": "float32" / mixed_float16 Policy dicts in layer configs
    (crashes DTypePolicy resolution in keras>=3.14)
  * RNN-only kwargs that no longer exist: "time_major", "implementation"
  * inner layers of Bidirectional lacking module info, so LSTM can't be
    located without explicit custom_objects

So: copy the .h5 next to the original as <name>.compat.h5, scrub those
legacy keys out of its model_config attribute, and load that. The scrubbed
copy is cached and rebuilt whenever the source model file changes.
Weights are untouched (mixed_float16 policies store variables in float32).
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

# Must be set before keras is imported anywhere in the process.
os.environ.setdefault("KERAS_BACKEND", "torch")

_LEGACY_KEYS = ("dtype", "time_major", "implementation")


def _scrub(node):
    if isinstance(node, dict):
        for key in _LEGACY_KEYS:
            node.pop(key, None)
        for value in node.values():
            _scrub(value)
    elif isinstance(node, list):
        for value in node:
            _scrub(value)


def load_legacy_h5(model_path: Path | str):
    import h5py
    import keras

    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at {model_path}")

    compat_path = model_path.with_suffix(".compat.h5")
    if (
        not compat_path.exists()
        or compat_path.stat().st_mtime < model_path.stat().st_mtime
    ):
        shutil.copy(model_path, compat_path)
        with h5py.File(compat_path, "r+") as f:
            config = json.loads(f.attrs["model_config"])
            _scrub(config)
            f.attrs["model_config"] = json.dumps(config)

    return keras.models.load_model(
        compat_path,
        compile=False,
        custom_objects={
            "LSTM": keras.layers.LSTM,
            "Bidirectional": keras.layers.Bidirectional,
        },
    )
