# Node.js イメージを使用
FROM node:18

# 作業ディレクトリを作成
WORKDIR /src

# 必要なファイルをコピー
COPY package.json ./
RUN npm install

# アプリのコードをコピー
COPY ./src ./src
COPY ./public ./public

# ポート設定（Cloud Run の標準ポート）
ENV PORT=8080
EXPOSE 8080

# アプリの起動
CMD ["node", "app.js"]
