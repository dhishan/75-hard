FROM node:20-alpine
RUN npm install -g firebase-tools
WORKDIR /firebase
COPY firebase.json .
COPY .firebaserc .
EXPOSE 4000 8080 9099
CMD ["firebase", "emulators:start", "--only", "auth,firestore", "--project", "demo-75hard"]
