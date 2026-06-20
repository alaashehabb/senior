#!/usr/bin/env python3
"""
Batch generate .pose files for all ASL words used in the educational tab.

Run once from the model-services directory:
    python generate_asl_poses.py

Or regenerate a single word:
    python generate_asl_poses.py hello

Or process a video file you already have:
    python generate_asl_poses.py --file hello /path/to/hello.mp4
"""

import sys
from asl_pipeline import (
    ASL_VIDEO_SOURCES,
    generate_pose_for_word,
    generate_pose_from_file,
    pose_path,
)

# All 17 words the educational tab uses
ALL_WORDS = list(ASL_VIDEO_SOURCES.keys())


def main():
    args = sys.argv[1:]

    # --file <word> <video_path>
    if args and args[0] == "--file":
        if len(args) < 3:
            print("Usage: python generate_asl_poses.py --file <word> <video_path>")
            sys.exit(1)
        word, video_path = args[1].lower(), args[2]
        generate_pose_from_file(word, video_path)
        return

    # specific word(s) or all
    targets = [a.lower() for a in args] if args else ALL_WORDS

    missing = [w for w in targets if w not in ASL_VIDEO_SOURCES]
    if missing:
        print(f"Unknown words: {missing}")
        print(f"Available: {ALL_WORDS}")
        sys.exit(1)

    print(f"Generating {len(targets)} .pose file(s) …\n")
    ok, failed = [], []

    for word in targets:
        try:
            generate_pose_for_word(word)
            ok.append(word)
        except Exception as e:
            print(f"  [ERROR] {word}: {e}\n")
            failed.append(word)

    print(f"\n{'='*50}")
    print(f"Done: {len(ok)} succeeded, {len(failed)} failed")
    if failed:
        print(f"Failed words: {failed}")
        print("\nTip: for a failed word, record/download the video yourself and run:")
        print("  python generate_asl_poses.py --file <word> <path/to/video.mp4>")


if __name__ == "__main__":
    main()
