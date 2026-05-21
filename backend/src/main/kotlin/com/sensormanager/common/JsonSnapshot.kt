package com.sensormanager.common

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.core.io.ClassPathResource

/**
 * Whitelist for snapshot file names — lowercase letters, digits, and hyphens only.
 * Excludes `/`, `.`, `..` and anything else that could escape the `data/` prefix
 * or reach an unintended classpath resource.
 *
 * `@PublishedApi internal` so the inline function below can reference it from
 * call sites in other files; not part of the public API.
 */
@PublishedApi
internal val SNAPSHOT_NAME_PATTERN: Regex = Regex("^[a-z0-9-]+$")

/** Fixed classpath subdirectory under which all snapshot files live. */
@PublishedApi
internal const val SNAPSHOT_DIR: String = "data"

/**
 * Loads `data/<name>.json` from the classpath and parses it as [T].
 *
 * Intended to be called eagerly from a Spring bean's primary constructor so
 * a missing or malformed data file causes application startup to fail with a
 * clear error message identifying the snapshot — instead of surfacing as an
 * opaque 500 the first time a user hits the endpoint.
 *
 * Path is constructed inside this function; [name] cannot contain `/`, `.`,
 * or any other separator. Anything outside `[a-z0-9-]+` is rejected up front,
 * so this helper can never reach a classpath resource outside the snapshot
 * directory regardless of who passes what.
 *
 * @param name bare snapshot name, e.g. `"locations"`. Do **not** include the
 *   `data/` prefix or the `.json` suffix — both are added here.
 *
 * @throws IllegalArgumentException if [name] contains characters outside the
 *   whitelist (e.g. `..`, `/`, `.json`).
 * @throws IllegalStateException if the file is missing, or if Jackson cannot
 *   deserialize it into [T]. The message always includes the resolved path;
 *   the cause (if any) is preserved.
 */
inline fun <reified T> loadJsonSnapshot(objectMapper: ObjectMapper, name: String): T {
    require(SNAPSHOT_NAME_PATTERN.matches(name)) {
        "Invalid snapshot name '$name' — only lowercase letters, digits, and hyphens are allowed"
    }
    val resourcePath = "$SNAPSHOT_DIR/$name.json"
    val resource = ClassPathResource(resourcePath)
    if (!resource.exists()) {
        throw IllegalStateException(
            "Missing required snapshot '$resourcePath'. " +
                "Re-run tools/build-data/parse-dump.mjs to regenerate the data snapshots."
        )
    }
    return try {
        resource.inputStream.use { objectMapper.readValue<T>(it) }
    } catch (e: Exception) {
        throw IllegalStateException(
            "Failed to parse snapshot '$resourcePath' as ${T::class.simpleName}: ${e.message}",
            e,
        )
    }
}
