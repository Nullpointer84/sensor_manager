package com.sensormanager.device

import com.fasterxml.jackson.databind.ObjectMapper
import com.sensormanager.common.loadJsonSnapshot
import org.springframework.stereotype.Repository

@Repository
internal class JsonDeviceRepository(objectMapper: ObjectMapper) : DeviceRepository {

    private val cached: List<Device> = loadJsonSnapshot(objectMapper, "devices")

    override fun findAll(): List<Device> = cached
}
