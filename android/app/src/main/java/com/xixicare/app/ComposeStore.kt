package com.xixicare.app

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class Baby(val id: String, val name: String, val birthday: String, val avatar: String = "")
enum class LogKind { FEEDING, SLEEP, DIAPER, GROWTH }
data class CareLog(
    val id: String = UUID.randomUUID().toString(),
    val babyId: String,
    val timestamp: String = Instant.now().toString(),
    val kind: LogKind,
    val subtype: String,
    val values: Map<String, String>
)

data class VaccineState(val choiceId: String = "", val completed: Boolean = false, val date: String = "")

class ComposeStore(private val context: Context) {
    private val prefs = context.getSharedPreferences("xixicare_compose", Context.MODE_PRIVATE)
    val babies = mutableStateListOf<Baby>()
    val logs = mutableStateListOf<CareLog>()
    var activeBabyId by mutableStateOf("")
    var darkTheme by mutableStateOf(false)
    var privacyAgreed by mutableStateOf(false)
    var autoSync by mutableStateOf(false)
    var archiveCode by mutableStateOf("")
    val vaccineStates = mutableMapOf<String, MutableMap<String, VaccineState>>()
    val allergens = mutableMapOf<String, MutableMap<String, Boolean>>()

    init { load() }

    val activeBaby: Baby get() = babies.firstOrNull { it.id == activeBabyId } ?: babies.first()
    fun babyLogs() = logs.filter { it.babyId == activeBabyId }.sortedByDescending { it.timestamp }

    fun saveBaby(baby: Baby) {
        val index = babies.indexOfFirst { it.id == baby.id }
        if (index >= 0) babies[index] = baby else babies.add(baby)
        activeBabyId = baby.id
        save()
    }
    fun deleteBaby(id: String) {
        if (babies.size <= 1) return
        babies.removeAll { it.id == id }; logs.removeAll { it.babyId == id }
        if (activeBabyId == id) activeBabyId = babies.first().id
        save()
    }
    fun saveLog(log: CareLog) {
        val index = logs.indexOfFirst { it.id == log.id }
        if (index >= 0) logs[index] = log else logs.add(log)
        save(); updateWidgetSnapshot()
    }
    fun deleteLog(id: String) { logs.removeAll { it.id == id }; save(); updateWidgetSnapshot() }
    fun setVaccine(itemId: String, state: VaccineState) {
        vaccineStates.getOrPut(activeBabyId) { mutableMapOf() }[itemId] = state; save()
    }
    fun setAllergen(name: String, checked: Boolean) {
        allergens.getOrPut(activeBabyId) { mutableMapOf() }[name] = checked; save()
    }
    fun switchBaby(id: String) { if (babies.any { it.id == id }) { activeBabyId = id; save() } }
    fun updateSettings() = save()

    fun exportJson(uri: Uri) {
        context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { it.write(snapshot().toString(2)) }
    }
    fun importJson(uri: Uri, overwrite: Boolean) {
        val text = context.contentResolver.openInputStream(uri)?.use { input -> BufferedReader(InputStreamReader(input)).readText() } ?: return
        val root = JSONObject(text)
        if (overwrite) { babies.clear(); logs.clear(); vaccineStates.clear(); allergens.clear() }
        val babyMap = babies.associateBy { it.id }.toMutableMap()
        root.optJSONArray("babies")?.let { array -> for (i in 0 until array.length()) babyFromJson(array.getJSONObject(i)).also { babyMap[it.id] = it } }
        babies.clear(); babies.addAll(babyMap.values)
        val logMap = logs.associateBy { it.id }.toMutableMap()
        root.optJSONArray("logs")?.let { array -> for (i in 0 until array.length()) logFromJson(array.getJSONObject(i)).also { logMap[it.id] = it } }
        logs.clear(); logs.addAll(logMap.values)
        if (babies.none { it.id == activeBabyId }) activeBabyId = babies.first().id
        save(); updateWidgetSnapshot()
    }

    fun snapshot(): JSONObject = JSONObject().apply {
        put("version", 2); put("updatedAt", Instant.now().toString())
        put("babies", JSONArray().apply { babies.forEach { put(babyJson(it)) } })
        put("logs", JSONArray().apply { logs.forEach { put(logJson(it)) } })
        put("activeBabyId", activeBabyId); put("darkTheme", darkTheme)
        put("vaccines", JSONObject().apply { vaccineStates.forEach { (baby, map) -> put(baby, JSONObject().apply { map.forEach { (id, state) -> put(id, JSONObject().put("choiceId", state.choiceId).put("completed", state.completed).put("date", state.date)) } }) } })
        put("allergens", JSONObject().apply { allergens.forEach { (baby, map) -> put(baby, JSONObject(map as Map<*, *>)) } })
    }

    private fun load() {
        val raw = prefs.getString("state", null)
        if (raw == null) {
            val baby = Baby(UUID.randomUUID().toString(), "宝宝", LocalDate.now().minusMonths(6).toString())
            babies.add(baby); activeBabyId = baby.id; save(); return
        }
        runCatching {
            val root = JSONObject(raw)
            root.optJSONArray("babies")?.let { a -> for (i in 0 until a.length()) babies.add(babyFromJson(a.getJSONObject(i))) }
            root.optJSONArray("logs")?.let { a -> for (i in 0 until a.length()) logs.add(logFromJson(a.getJSONObject(i))) }
            activeBabyId = root.optString("activeBabyId")
            darkTheme = root.optBoolean("darkTheme"); privacyAgreed = prefs.getBoolean("privacyAgreed", false)
            autoSync = prefs.getBoolean("autoSync", false); archiveCode = prefs.getString("archiveCode", "") ?: ""
            root.optJSONObject("vaccines")?.keys()?.forEach { baby ->
                val map = mutableMapOf<String, VaccineState>(); val obj = root.getJSONObject("vaccines").getJSONObject(baby)
                obj.keys().forEach { id -> obj.getJSONObject(id).also { map[id] = VaccineState(it.optString("choiceId"), it.optBoolean("completed"), it.optString("date")) } }
                vaccineStates[baby] = map
            }
            root.optJSONObject("allergens")?.keys()?.forEach { baby ->
                val map = mutableMapOf<String, Boolean>(); val obj = root.getJSONObject("allergens").getJSONObject(baby)
                obj.keys().forEach { map[it] = obj.optBoolean(it) }; allergens[baby] = map
            }
        }
        if (babies.isEmpty()) { val b = Baby(UUID.randomUUID().toString(), "宝宝", LocalDate.now().minusMonths(6).toString()); babies.add(b); activeBabyId = b.id }
        if (babies.none { it.id == activeBabyId }) activeBabyId = babies.first().id
    }

    private fun save() {
        prefs.edit().putString("state", snapshot().toString()).putBoolean("privacyAgreed", privacyAgreed)
            .putBoolean("autoSync", autoSync).putString("archiveCode", archiveCode).apply()
    }
    private fun babyJson(b: Baby) = JSONObject().put("id", b.id).put("name", b.name).put("birthday", b.birthday).put("avatar", b.avatar)
    private fun babyFromJson(o: JSONObject) = Baby(o.getString("id"), o.optString("name", "宝宝"), o.optString("birthday", LocalDate.now().toString()), o.optString("avatar"))
    private fun logJson(l: CareLog) = JSONObject().put("id", l.id).put("babyId", l.babyId).put("timestamp", l.timestamp).put("kind", l.kind.name).put("subtype", l.subtype).put("values", JSONObject(l.values))
    private fun logFromJson(o: JSONObject): CareLog {
        val values = mutableMapOf<String, String>(); o.optJSONObject("values")?.let { v -> v.keys().forEach { values[it] = v.optString(it) } }
        return CareLog(o.getString("id"), o.getString("babyId"), o.optString("timestamp", Instant.now().toString()), runCatching { LogKind.valueOf(o.optString("kind")) }.getOrDefault(LogKind.FEEDING), o.optString("subtype"), values)
    }

    private fun updateWidgetSnapshot() {
        val days = (6 downTo 0).map { LocalDate.now().minusDays(it.toLong()) }
        val daily = JSONArray()
        days.forEach { day ->
            val entries = babyLogs().filter { runCatching { Instant.parse(it.timestamp).atZone(java.time.ZoneId.systemDefault()).toLocalDate() }.getOrNull() == day }
            val milk = entries.filter { it.kind == LogKind.FEEDING && it.subtype == "bottle" }.sumOf { it.values["volumeMl"]?.toDoubleOrNull() ?: 0.0 }
            val sleep = entries.filter { it.kind == LogKind.SLEEP }.sumOf { it.values["durationMinutes"]?.toDoubleOrNull() ?: 0.0 }
            daily.put(JSONObject().put("date", day.toString()).put("milk", milk).put("sleep", sleep).put("interval", 0))
        }
        context.getSharedPreferences("widget_charts", Context.MODE_PRIVATE).edit().putString("daily", daily.toString()).apply()
        FormulaWidgetProvider.refreshAll(context)
    }
}
