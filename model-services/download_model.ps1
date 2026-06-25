# Download trained SLR models (if missing)
# Source: https://github.com/ahmed171102/SLR-Main

$ErrorActionPreference = "Stop"
$modelsDir = Join-Path $PSScriptRoot "models"
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

$models = @(
  @{
    Name = "asl_mediapipe_mlp_model_engineered.h5"
    Url  = "https://github.com/ahmed171102/SLR-Main/raw/main/Letters_ORIGINAL/English_Letters/asl_mediapipe_mlp_model_engineered.h5"
  },
  @{
    Name = "arsl_mediapipe_mlp_model_bestV2.2.h5"
    Url  = "https://github.com/ahmed171102/SLR-Main/raw/main/Letters_ORIGINAL/ArSL%20(Arabic%20Letters)/arsl_mediapipe_mlp_model_bestV2.2.h5"
  }
)

foreach ($model in $models) {
  $outFile = Join-Path $modelsDir $model.Name
  if (Test-Path $outFile) {
    Write-Host "Already exists: $($model.Name)"
    continue
  }
  Write-Host "Downloading $($model.Name)..."
  Invoke-WebRequest -Uri $model.Url -OutFile $outFile
  Write-Host "Saved to $outFile"
}
