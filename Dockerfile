# Dockerfile for letsencrypt Client
FROM node:6-alpine
RUN mkdir -p usr/src/app
WORKDIR /usr/src/app
COPY * /usr/src/app/
COPY src /usr/src/app/src
COPY public /usr/src/app/public
RUN  apk add --no-cache --update --virtual .build-deps make gcc g++ python && \
    npm install && \
    apk del .build-deps
EXPOSE 80 443 4000 5002 8443
CMD ["npm","run","test"]
