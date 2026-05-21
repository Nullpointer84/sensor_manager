package com.sensormanager.common

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.core.io.ClassPathResource

/**
 * Loads a JSON classpath resource at the call site and parses it as [T].
 *
 * Intended to be called eagerly from a Spring bean's primary constructor or
 * a property initializer so that a missing or malformed data file causes
 * application startup to fail with a clear error message identifying the
 * resource — instead of surfacing as an opaque 500 the first time a user
 * hits the endpoint.
 *
 * @throws IllegalStateException if the resource does not exist on the
 *   classpath, or if Jackson cannot deserialize it into [T]. The message
 *   always includes the resource path; the cause (if any) is preserved.
 */
inline fun <reified T> loadClasspathJson(objectMapper: ObjectMapper, resourcePath: String): T {
    val resource = ClassPathResource(resourcePath)
    if (!resource.exists()) {
        throw IllegalStateException(
            "Missing required classpath resource '$resourcePath'. " +
                "Re-run tools/build-data/parse-dump.mjs to regenerate the data snapshots."
        )
    }
    return try {
        resource.inputStream.use { objectMapper.readValue<T>(it) }
    } catch (e: Exception) {
        throw IllegalStateException(
            "Failed to parse classpath resource '$resourcePath' as ${T::class.simpleName}: ${e.message}",
            e,
        )
    }
}
