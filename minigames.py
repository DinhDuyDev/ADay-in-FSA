from settings import WINDOW_WIDTH
## Correct labels
class Text:
    def __init__(self, x, y, text):
        self.x, self.y = x, y
        self.text = text
        self.order = -1 # no order yet
    def __eq__(self, value):
        return self.text == value
    

order1 = [
    Text(WINDOW_WIDTH/2, 190, "Mở PowerPoint và bắt đầu xây\ndựng slide từ file chính sách"),
    Text(WINDOW_WIDTH/2, 240, "Hỏi lại người yêu cầu:\nđiều gì đang thực sự xảy ra?"),
    Text(WINDOW_WIDTH/2, 290, "Xác định: sau khoá học,\nngười ta phải LÀM được gì khác đi"),
    Text(WINDOW_WIDTH/2, 340, "Hẹn SME (chuyên gia chính sách)\nđể hiểu điểm dễ sai")
]
order1_answer = [
     "Hỏi lại người yêu cầu:\nđiều gì đang thực sự xảy ra?",
     "Xác định: sau khoá học,\nngười ta phải LÀM được gì khác đi",
     "Hẹn SME (chuyên gia chính sách)\nđể hiểu điểm dễ sai",
     "Mở PowerPoint và bắt đầu xây\ndựng slide từ file chính sách"
]

selection1 = [
    Text(WINDOW_WIDTH/2, 190, "Dạ được, em làm slide\ngửi chị cuối tuần."),
    Text(WINDOW_WIDTH/2, 240, "Trước khi làm, cho em hỏi:\nnhân viên đang hay sai ở khâu nào ạ?"),
    Text(WINDOW_WIDTH/2, 290, "Em làm, nhưng ta thống nhất trước:\nsau đào tạo nhân viên phải làm được gì ạ?"),
]
selection1_answer = "Trước khi làm, cho em hỏi:\nnhân viên đang hay sai ở khâu nào ạ?"

order2 = [
    Text(WINDOW_WIDTH/2, 190, "Tình huống cuối:\ntự xử lý một ca mới"),
    Text(WINDOW_WIDTH/2, 240, "Chỉ cách làm đúng,\nkèm ví dụ mẫu"),
    Text(WINDOW_WIDTH/2, 290, "Mở đầu bằng một tình\nhuống sai thật (hook)"),
    Text(WINDOW_WIDTH/2, 340, "Nói rõ sau phần này\nbạn sẽ làm được gì"),
    Text(WINDOW_WIDTH/2, 390, "Cho người học tự\nđiền thử một biểu mẫu")
]

order2_answer = [
    "Mở đầu bằng một tình\nhuống sai thật (hook)",
    "Nói rõ sau phần này\nbạn sẽ làm được gì",
    "Chỉ cách làm đúng,\nkèm ví dụ mẫu",
    "Cho người học tự\nđiền thử một biểu mẫu",
    "Tình huống cuối:\ntự xử lý một ca mới",
]


selection2 = [
    Text(WINDOW_WIDTH/2, 190, "Thêm hết vào cho SME yên tâm, \n40 slide cũng được."),
    Text(WINDOW_WIDTH/2, 240, "Giữ phần cốt lõi ngắn,\nđẩy 9 ngoại tệ thành tài liệu tra cứu khi cần."),
    Text(WINDOW_WIDTH/2, 290, "Hỏi SME: trong 9 ngoại tệ đó,\ncái nào nhân viên THỰC SỰ gặp hàng tuần?"),
]
selection2_answer = "Giữ phần cốt lõi ngắn,\nđẩy 9 ngoại tệ thành tài liệu tra cứu khi cần. Hỏi SME: trong 9 ngoại tệ đó,\ncái nào nhân viên THỰC SỰ gặp hàng tuần?"

order3 = [
    Text(WINDOW_WIDTH/2, 190, "Dựng nội dung và tương\ntác theo storyboard."),
    Text(WINDOW_WIDTH/2, 240, "Ghép narration và canh\naudio khớp hình"),
    Text(WINDOW_WIDTH/2, 290, "Publish thử lên LMS\nvà bấm qua từng slide"),
    Text(WINDOW_WIDTH/2, 340, "Dựng template: font, màu,\nnút điều hướng, bố cục chuẩn"),
    Text(WINDOW_WIDTH/2, 390, "Kiểm tra accessibility: alt\ntext, tab order, phụ đề")
]
order3_answer = [
    "Dựng template: font, màu,\nnút điều hướng, bố cục chuẩn",
    "Dựng nội dung và tương\ntác theo storyboard.",
    "Ghép narration và canh\naudio khớp hình",
    "Kiểm tra accessibility: alt\ntext, tab order, phụ đề",
    "Publish thử lên LMS\nvà bấm qua từng slide",
]

selection3 = [
    Text(WINDOW_WIDTH/2, 190, "Tự đoán ý ID rồi dựng luôn cho kịp tiến độ."),
    Text(WINDOW_WIDTH/2, 240, "Nhắn ID hỏi rõ ý định trước khi dựng."),
    Text(WINDOW_WIDTH/2, 290, "Dựng một placeholder rồi gắn cờ “cần ID xác nhận”, làm tiếp phần khác."),
]
selection3_answer = "Nhắn ID hỏi rõ ý định trước khi dựng. Dựng một placeholder rồi gắn cờ “cần ID xác nhận”, làm tiếp phần khác."

order4 = [
    Text(WINDOW_WIDTH/2, 190, "Narration slide 5 lệch\nhình khoảng một giây"),
    Text(WINDOW_WIDTH/2, 240, "Ảnh biểu mẫu thiếu alt text\ntrình đọc màn hình bỏ qua."),
    Text(WINDOW_WIDTH/2, 290, "Nút “Tiếp” ở slide 3 bấm\nkhông ăn, kẹt cả khoá"),
    Text(WINDOW_WIDTH/2, 340, "Câu hỏi cuối không ghi\nnhận kết quả về LMS")
]
order4_answer = [
    "Nút “Tiếp” ở slide 3 bấm\nkhông ăn, kẹt cả khoá",
    "Câu hỏi cuối không ghi\nnhận kết quả về LMS",
    "Ảnh biểu mẫu thiếu alt text\ntrình đọc màn hình bỏ qua.",
    "Narration slide 5 lệch\nhình khoảng một giây",
]

selection4 = [
    Text(WINDOW_WIDTH/2, 190, "Ở lại làm hiệu ứng cho thật\nấn tượng, chấp nhận trễ."),
    Text(WINDOW_WIDTH/2, 240, "Chốt bản đang chạy tốt, lên sóng\nđúng hẹn, ghi hiệu ứng vào “bản sau”."),
    Text(WINDOW_WIDTH/2, 290, "Hỏi ID/khách: hiệu ứng này\ncó đáng để trễ giờ không?"),
]
selection4_answer = "Chốt bản đang chạy tốt, lên sóng\nđúng hẹn, ghi hiệu ứng vào “bản sau”. Hỏi ID/khách: hiệu ứng này\ncó đáng để trễ giờ không?"

buffer = []
