# app/__init__.py
import glob
import os
import shutil

from flask import Flask

from .routes import bp as main_bp
from .tasks import celery_init_app


def create_app():
    app = Flask(__name__)
    app.config.from_mapping(
        CELERY=dict(
            broker_url="redis://redis",
            result_backend="redis://redis",
            task_ignore_result=True,
        ),
    )
    celery_init_app(app)

    UPLOAD_FOLDER = os.path.join(app.root_path, "uploads")
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    for p in glob.glob(UPLOAD_FOLDER + os.path.sep + "*"):
        if os.path.isfile(p):
            os.remove(p)

    TEMP_FOLDER = os.path.join(app.root_path, "temp")
    app.config["TEMP_FOLDER"] = TEMP_FOLDER
    os.makedirs(TEMP_FOLDER, exist_ok=True)

    # Clear the temp folder on app start
    for p in glob.glob(TEMP_FOLDER + os.path.sep + "*"):
        if os.path.isfile(p):
            os.remove(p)
        if os.path.isdir(p):
            shutil.rmtree(p)

    app.register_blueprint(main_bp)

    return app
