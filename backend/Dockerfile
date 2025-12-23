# Stage 1: Build the App (using Maven)
FROM maven:3.9.4-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
# Build the jar, skipping tests to save time
RUN mvn clean package -DskipTests

# Stage 2: Run the App (Lightweight Image)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/MiniDrive-1.0-SNAPSHOT.jar app.jar
# Expose the gRPC port
EXPOSE 50051
ENTRYPOINT ["java", "-jar", "app.jar"]