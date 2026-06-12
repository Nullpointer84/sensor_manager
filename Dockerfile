# Multi-stage build: React SPA -> Spring Boot jar (SPA baked into static/) -> slim JRE runtime.
# The backend serves both the API and the built frontend from one origin, so the
# client's relative /api/... calls work in production without CORS or proxy config.

# --- Stage 1: build the web app -------------------------------------------
FROM node:22-alpine AS web-build
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Stage 2: build the backend jar ----------------------------------------
FROM eclipse-temurin:21-jdk AS backend-build
WORKDIR /build
# Gradle config first so the dependency layer caches across source-only changes.
COPY backend/gradlew backend/settings.gradle.kts backend/build.gradle.kts backend/gradle.properties ./
COPY backend/gradle/ gradle/
# gradlew is committed without the executable bit; chmod is required on Linux.
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies --quiet || true
COPY backend/src/ src/
# Bake the SPA into the jar's classpath static/ — Spring Boot serves it at /.
COPY --from=web-build /web/dist/ src/main/resources/static/
# Tests run in CI, not here; bootJar only assembles. Exclude the -plain.jar.
RUN ./gradlew --no-daemon bootJar \
    && find build/libs -name '*.jar' ! -name '*-plain.jar' -exec cp {} app.jar \;

# --- Stage 3: runtime -------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=backend-build /build/app.jar app.jar
# Respect the container memory limit instead of the host's RAM. 60% on a 512MB
# Fly VM caps the heap at ~300MB and leaves headroom for metaspace, code cache,
# GC structures, and Tomcat thread stacks — avoids a kernel OOM-kill under load.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0"
EXPOSE 8080
USER app
ENTRYPOINT ["java", "-jar", "app.jar"]
