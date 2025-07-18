from reazonspeech.nemo.asr import audio_from_path, load_model
from reazonspeech.nemo.asr import transcribe as transcribe_nemo_asr


def transcribe(
    audio_file,
):
    model = load_model()
    audio = audio_from_path(audio_file)

    # Recognize speech
    ret = transcribe_nemo_asr(model, audio)

    return [
        {"start": s.start_seconds, "end": s.end_seconds, "text": s.text}
        for s in ret.segments
    ]
