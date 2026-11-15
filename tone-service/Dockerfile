ARG PYTHON_IMAGE=mirror.gcr.io/library/python:3.11-slim

FROM ${PYTHON_IMAGE}

# ffmpeg — декодирование аудио; git — установка T-one из репозитория;
# build-essential, cmake, libboost — сборка KenLM из исходников
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git build-essential cmake libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# падаем при сборке, если установился не тот пакет `tone`
RUN python -c "from tone import StreamingCTCPipeline, read_audio"

# модели разметки по голосу вшиваем в образ (/opt/diar, не в том /models):
# у пользователя сети нет. База переопределяется для сборки из РФ.
COPY fetch_diar_models.py ./
ARG DIAR_MODELS_BASE=https://github.com/k2-fsa/sherpa-onnx/releases/download
RUN python fetch_diar_models.py --out /opt/diar --base "$DIAR_MODELS_BASE"

COPY diarize.py gigaam.py audio_level.py app.py ./

# падаем при сборке, если разметка не заводится (один процесс — как в сервисе)
RUN python -c "import onnxruntime, tone, diarize, numpy; diarize.run(diarize.load('/opt/diar', diarize.DEFAULT_THRESHOLD), numpy.zeros(48000, dtype='float32'))"

# падаем при сборке, если GigaAM-обвязка не импортируется (веса не вшиты — качаются по команде врача)
RUN python -c "import onnx_asr, gigaam"

# модель T-one скачивается с HuggingFace при первом старте в HF_HOME (туда же — веса GigaAM)
ENV HF_HOME=/models
RUN useradd --system --create-home tone \
    && mkdir -p /models \
    && chown -R tone:tone /models

USER tone

EXPOSE 5001

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5001"]
