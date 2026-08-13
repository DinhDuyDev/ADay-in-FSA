import math
def dist(x1, y1, x2, y2) -> float:
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

def point_direction(x, y, a, b):
    dx = a - x
    dy = b - y
    deg = math.atan2(-dy, dx)
    return math.degrees(deg)