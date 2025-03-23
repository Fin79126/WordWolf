# Node.js イメージを使用
FROM node:18

# アプリのコードをコピー
COPY ./src ./project/src
COPY ./public ./project/public

# 作業ディレクトリを作成
WORKDIR /project

# 必要なファイルをコピー
COPY package.json ./
RUN npm install

# ポート設定（Cloud Run の標準ポート）
ENV PORT=8080
EXPOSE 8080

# アプリの起動
CMD ["node", "src/app.js"]
