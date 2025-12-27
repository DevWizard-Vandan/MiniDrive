# Stage 1: Build (Using standard Linux to support Protoc)
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
# Build the jar
RUN mvn clean package -DskipTests

# Stage 2: Run (Using standard Linux runtime)
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/MiniDrive-1.0-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]