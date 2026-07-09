import WidgetKit
import SwiftUI

// 欄位必須與 src/lib/widget_core.ts 的 WidgetPayload 一致（dateKey/caloriesEaten/caloriesTarget/workouts/waterMl/waterTargetMl）。
struct KiboToday: Codable {
  var dateKey: String = ""
  var caloriesEaten: Int = 0
  var caloriesTarget: Int = 0
  var workouts: Int = 0
  var waterMl: Int = 0
  var waterTargetMl: Int = 0
}

func loadToday() -> KiboToday {
  let defaults = UserDefaults(suiteName: "group.app.kibo.fitness")
  guard let raw = defaults?.string(forKey: "today"),
        let data = raw.data(using: .utf8),
        let decoded = try? JSONDecoder().decode(KiboToday.self, from: data)
  else { return KiboToday() }
  return decoded
}

struct Entry: TimelineEntry { let date: Date; let data: KiboToday }

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(date: Date(), data: KiboToday()) }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(Entry(date: Date(), data: loadToday()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    completion(Timeline(entries: [Entry(date: Date(), data: loadToday())], policy: .atEnd))
  }
}

struct KiboWidgetView: View {
  var data: KiboToday
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Kibo 今日").font(.caption).foregroundColor(.secondary)
      Text("\(data.caloriesEaten) / \(data.caloriesTarget) kcal").font(.headline)
      HStack(spacing: 10) {
        Label("\(data.workouts)", systemImage: "figure.strengthtraining.traditional")
        Label("\(data.waterMl)ml", systemImage: "drop.fill")
      }.font(.caption)
    }.padding()
  }
}

@main
struct KiboWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "kibo_widget", provider: Provider()) { entry in
      KiboWidgetView(data: entry.data)
    }
    .configurationDisplayName("Kibo 今日")
    .description("今日熱量、訓練、喝水一眼看")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
