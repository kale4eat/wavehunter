from faster_whisper import WhisperModel


def transcribe(
    audio_file,
    model_size="large-v3",
    compute_type="default",
    beam_size=5,
    best_of=5,
    language="",
    initial_prompt="",
):
    model = WhisperModel(model_size, compute_type=compute_type)
    segments, _ = model.transcribe(
        audio_file,
        beam_size=beam_size,
        best_of=best_of,
        language=language if language != "" else None,
        initial_prompt=initial_prompt if initial_prompt != "" else None,
    )

    segments = list(segments)
    return [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
