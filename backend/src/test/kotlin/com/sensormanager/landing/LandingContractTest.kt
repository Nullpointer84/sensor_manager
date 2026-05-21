package com.sensormanager.landing

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.get

/**
 * Pins the JSON shape of every landing endpoint under `/api/landing/`.
 *
 * Asserts the exact set of field names per response and (where non-nullable)
 * the JSON type of each field. Does **not** assert any values — the test
 * stays green when sensor data is regenerated, and red when the REST contract
 * drifts (renamed/removed/added field, type change, moved path).
 *
 * Update this test only when an API change is intentional. A failure here
 * means a public API change has happened — verify the web client (and any
 * other consumer) is updated in the same change.
 *
 * Implementation note: field-set assertions parse the response body with
 * Jackson rather than using JsonPath wildcards, because JsonPath skips null
 * values and several response shapes contain nullable fields.
 */
@SpringBootTest
@AutoConfigureMockMvc
class LandingContractTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
) {

    @Test
    fun `GET stats pins documented field set and types`() {
        val result = mockMvc.get("/api/landing/stats").andExpect {
            status { isOk() }
            jsonPath("$.deviceCount") { isNumber() }
            jsonPath("$.locationCount") { isNumber() }
            jsonPath("$.readingCount") { isNumber() }
            jsonPath("$.earliestReadingAt") { isString() }
            jsonPath("$.latestReadingAt") { isString() }
        }.andReturn()

        assertFieldSet(
            result,
            setOf("deviceCount", "locationCount", "readingCount", "earliestReadingAt", "latestReadingAt"),
        ) { it }
    }

    @Test
    fun `GET locations pins documented field set per row`() {
        val result = mockMvc.get("/api/landing/locations").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
            jsonPath("$[0].id") { isNumber() }
            jsonPath("$[0].name") { isString() }
        }.andReturn()

        assertFieldSet(
            result,
            setOf("id", "name", "description", "currentDeviceHwid", "currentDeviceSince"),
        ) { it[0] }
    }

    @Test
    fun `GET devices pins documented field set per row`() {
        val result = mockMvc.get("/api/landing/devices").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
            jsonPath("$[0].hwid") { isString() }
        }.andReturn()

        assertFieldSet(
            result,
            setOf("hwid", "currentLocationId", "currentLocationName", "firstSeenAt", "lastSeenAt"),
        ) { it[0] }
    }

    @Test
    fun `GET latest-readings pins documented field set per row`() {
        val result = mockMvc.get("/api/landing/latest-readings").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
            jsonPath("$[0].locationId") { isNumber() }
            jsonPath("$[0].locationName") { isString() }
        }.andReturn()

        assertFieldSet(
            result,
            setOf(
                "locationId",
                "locationName",
                "deviceHwid",
                "timestamp",
                "indoorTempC",
                "humidityPct",
                "pressureHpa",
                "co2Ppm",
                "breathVoc",
                "iaqStatic",
            ),
        ) { it[0] }
    }

    @Test
    fun `GET temperature-trend pins documented field set and types per row`() {
        val result = mockMvc.get("/api/landing/temperature-trend").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
            jsonPath("$[0].date") { isString() }
            jsonPath("$[0].locationId") { isNumber() }
            jsonPath("$[0].locationName") { isString() }
            jsonPath("$[0].meanTempC") { isNumber() }
            jsonPath("$[0].minTempC") { isNumber() }
            jsonPath("$[0].maxTempC") { isNumber() }
        }.andReturn()

        assertFieldSet(
            result,
            setOf("date", "locationId", "locationName", "meanTempC", "minTempC", "maxTempC"),
        ) { it[0] }
    }

    @Test
    fun `GET co2-summary pins documented field set and types per row`() {
        val result = mockMvc.get("/api/landing/co2-summary").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
            jsonPath("$[0].date") { isString() }
            jsonPath("$[0].locationId") { isNumber() }
            jsonPath("$[0].locationName") { isString() }
            jsonPath("$[0].meanCo2Ppm") { isNumber() }
            jsonPath("$[0].peakCo2Ppm") { isNumber() }
        }.andReturn()

        assertFieldSet(
            result,
            setOf("date", "locationId", "locationName", "meanCo2Ppm", "peakCo2Ppm"),
        ) { it[0] }
    }

    // ----- helpers -----

    /**
     * Asserts the JSON node selected by [extract] from the response body is an
     * object whose top-level field names are exactly [expected]. Catches added,
     * removed, and renamed fields — including those with null values.
     */
    private fun assertFieldSet(
        result: MvcResult,
        expected: Set<String>,
        extract: (JsonNode) -> JsonNode,
    ) {
        val tree = objectMapper.readTree(result.response.contentAsString)
        val node = extract(tree)
        val actual = node.fieldNames().asSequence().toSet()
        assertEquals(expected, actual, "Response field set drifted from documented contract")
    }
}
