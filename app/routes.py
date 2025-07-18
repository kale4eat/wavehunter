import os
import shutil
import uuid

import torchaudio
from celery.result import AsyncResult
from flask import (
    Blueprint,
    current_app,
    jsonify,
    render_template,
    request,
    send_from_directory,
)

from .tasks import transcribe_task

bp = Blueprint("main", __name__, template_folder="templates")


@bp.route("/")
def home():
    return render_template("index.html")


@bp.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    extension = os.path.splitext(file.filename)[1]  # type: ignore
    unique_filename = f"{uuid.uuid4()}{extension}"
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    assert isinstance(file.filename, str)
    filepath = os.path.join(upload_folder, unique_filename)
    file.save(filepath)
    print(file.filename + " -> " + unique_filename)

    file_url = f"/uploads/{unique_filename}"
    return jsonify({"filename": unique_filename, "file_url": file_url})


@bp.route("/uploads/<filename>")
def uploaded_file(filename):
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    return send_from_directory(upload_folder, filename)


@bp.route("/transcript/<filename>", methods=["POST"])
def start_transcript_file(filename):
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    audio_file = os.path.join(upload_folder, filename)

    data = request.json
    assert data
    tool = data.get("tool", "faster-whisper")
    params = {}
    params["model_size"] = data.get("model", "large-v3")
    params["language"] = data.get("lang", None)
    params["initial_prompt"] = data.get("prompt", None)
    result = transcribe_task.apply_async((audio_file, tool, params)) # type: ignore
    return {"result_id": result.id}


@bp.route("/transcript_result/<id>")
def task_result(id: str) -> dict[str, object]:
    result = AsyncResult(id)
    if not result.successful():
        print(result.result)
        
    return {
        "ready": result.ready(),
        "successful": result.successful(),
        "segments": result.result if result.successful() else None,
    }


@bp.route("/export_speech_dataset/<filename>", methods=["POST"])
def export_speech_dataset(filename):
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    audio_file = os.path.join(upload_folder, filename)

    data = request.json
    assert data

    segments = data.get("segments")
    original_file_name = data.get("original-file-name")
    waveform, sample_rate = torchaudio.load(audio_file)

    temp_folder = current_app.config["TEMP_FOLDER"]
    work_dir = os.path.join(
        temp_folder, os.path.splitext(os.path.basename(original_file_name))[0]
    )
    if os.path.isdir(work_dir):
        shutil.rmtree(work_dir)
    os.makedirs(work_dir, exist_ok=True)

    for i, s in enumerate(segments):
        start_sample = max(0, int(s["start"] * sample_rate) - 1)
        end_sample = max(0, int(s["end"] * sample_rate) - 1)
        view = waveform[..., start_sample:end_sample]
        dst = os.path.join(work_dir, str(i).zfill(3) + ".wav")
        torchaudio.save(dst, view, sample_rate, format="wav")
        with open(
            os.path.join(work_dir, str(i).zfill(3) + ".lbl"),
            mode="w",
            encoding="utf-8",
        ) as f:
            f.write(s["text"])

    zip_file_id = str(uuid.uuid4())
    zip_file = os.path.join(temp_folder, zip_file_id)
    shutil.make_archive(zip_file, format="zip", root_dir=work_dir)
    assert os.path.isfile(os.path.join(temp_folder, zip_file + ".zip"))
    return send_from_directory(temp_folder, zip_file_id + ".zip")
