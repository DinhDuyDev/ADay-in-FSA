## Correct labels
available_labels = [
    "Target audience",
    "Training objectives",
    "Learning content",
    "Learning style",
    "Course duration",
    "Assessment method",
    "Logo màu sắc",
    "Mức lương nhân viên",
    "Số lượng phòng họp",
    "Địa chỉ văn phòng",
]

class DragText:
    def __init__(self, x, y):
        self.x, self.y = x, y
        
current_drag_text:DragText = None