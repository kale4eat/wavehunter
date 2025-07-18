# wavehunter

This is a tool for creating audio datasets.

This project was developed for learning purposes.

## Technologies Tried

- Wavesurfer.js
- Visual Studio Code Dev Containers
- Backend stack: Flask, Redis, Celery

## Tested Environment

- Windows 11
- WSL2 (Ubuntu 22.04)
- CUDA 12.8

## Usage

```bash
git clone https://github.com/kale4eat/wavehunter
cd wavehunter
docker compose up -d
```

Open http://localhost:5000/

Upload an audio file

Click [Create Sgment by Transcript]

Edit rigion as needed

Click [Export Segments]

-> Downloads a JSON file containing segment information

Click [Click Export Speech Dataset]

-> Downloads a ZIP file containing .lbl files and audio clips for each region
