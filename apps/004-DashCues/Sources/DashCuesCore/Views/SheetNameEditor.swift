import SwiftUI

struct SheetCreateRequest: Identifiable {
    let id = UUID()
    let kind: SheetKind
}

/// Names a new sheet; `onSave` returns an error message to keep the sheet open.
struct SheetNameEditor: View {
    let kind: SheetKind
    let onSave: (String) -> String?

    @Environment(\.dismiss) private var dismiss
    @FocusState private var isNameFocused: Bool
    @State private var name = ""
    @State private var errorMessage: String?

    private func submit() {
        if let error = onSave(name) {
            errorMessage = error
        } else {
            dismiss()
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(kind == .shortcuts ? "新增快捷鍵工作表" : "新增 Key-Value 工作表").font(.headline)
            TextField("工作表名稱", text: $name)
                .focused($isNameFocused)
                .accessibilityIdentifier("dashboard.sheet-name")
                .onChange(of: name) { _ in errorMessage = nil }
                .onSubmit { submit() }
            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("dashboard.sheet-name-error")
            }
            HStack {
                Spacer()
                Button("取消") { dismiss() }
                Button("建立") {
                    submit()
                }
                .keyboardShortcut(.defaultAction)
                .accessibilityIdentifier("dashboard.save-sheet-name")
            }
        }
        .padding(20)
        .frame(width: 360)
        .onAppear {
            isNameFocused = true
        }
    }
}
