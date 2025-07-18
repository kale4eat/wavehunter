import os

import torch
from celery import Celery, Task, shared_task
from flask import (
    Flask,
    current_app,
    request,
)

from . import faster_whisper_mod, nemo_asr_mod


def celery_init_app(app: Flask) -> Celery:
    class FlaskTask(Task):
        def __call__(self, *args: object, **kwargs: object) -> object:
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app = Celery(app.name, task_cls=FlaskTask)
    celery_app.config_from_object(app.config["CELERY"])
    celery_app.set_default()
    app.extensions["celery"] = celery_app
    return celery_app


@shared_task(ignore_result=False)
def transcribe_task(audio_file, tool, params):
    torch.cuda.empty_cache()
    if tool == "faster-whisper":
        segments = faster_whisper_mod.transcribe(audio_file, **params)
    elif tool == "nemo-asr":
        segments = nemo_asr_mod.transcribe(audio_file)
    return segments
