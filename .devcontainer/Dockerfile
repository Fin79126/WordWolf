# Ubuntu - DevContiner公式イメージ
# * GitHub | devcontainer/cpp : https://github.com/devcontainers/images/tree/main/src/base-ubuntu
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# [オプション] 追加パッケージのインストール
#
# 使い方 :
#  * 「&& apt-get -y install --no-install-recommends <install packages>\」
#    のコメントアウトを外し、<install packages>の部分にパッケージを追加
#
RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get upgrade -y \
    # && apt-get -y install --no-install-recommends <install packages> \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ARG USERNAME=vscode
# USER - https://docs.docker.jp/engine/reference/builder.html#user
# コンテナ内で実行されるコマンドのユーザーを、指定された$USERNAMEに切り替え
USER $USERNAME
# WORKDIR - https://docs.docker.jp/engine/reference/builder.html#workdir
# コンテナ内のワーキングディレクトリを、指定されたユーザーのホームディレクトリ（/home/$USERNAME/）に設定
WORKDIR /home/$USERNAME/

# mise のインストール
# mise: https://mise.jdx.dev
RUN curl https://mise.run | sh \
    && echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
