# ステージ1: base image
FROM mcr.microsoft.com/devcontainers/base:ubuntu AS base

RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ARG USERNAME=vscode
USER $USERNAME
WORKDIR /home/$USERNAME/

# mise のインストール
RUN curl https://mise.run | sh \
    && echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc

# ステージ2: gcloud SDK をインストール
FROM google/cloud-sdk:slim AS gcloud

# gcloudに必要な設定をする場合はここで追加
# 例: RUN gcloud auth activate-service-account ...

# ステージ3: 最終的なイメージ（base と gcloud を統合）
FROM base


# gcloud SDK を base イメージにコピー
# COPY --from=gcloud /usr/local/google-cloud-sdk /usr/local/google-cloud-sdk
COPY --from=gcloud /usr/lib/google-cloud-sdk /usr/lib/google-cloud-sdk

# 必要な環境変数を設定（gcloudが動作するように）
ENV PATH="/usr/lib/google-cloud-sdk/bin:$PATH"

# 最後に mise 環境をアクティブにするための設定を追加
RUN echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc