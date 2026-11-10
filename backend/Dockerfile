FROM docker.io/library/maven:3.9-eclipse-temurin-21 AS dev
WORKDIR /app
COPY dev-run.sh /usr/local/bin/plateon-dev-run
RUN chmod +x /usr/local/bin/plateon-dev-run
CMD ["plateon-dev-run"]

FROM docker.io/library/maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src src
RUN mvn -q -DskipTests package
FROM docker.io/library/eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/plateon-0.0.1-SNAPSHOT.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
