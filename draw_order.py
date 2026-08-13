import pygame
import math
from settings import *

def dist_to_camera(x, y, z):
    return math.sqrt((WINDOW_WIDTH/2 - x) ** 2 + (WINDOW_HEIGHT - y) ** 2 + (512 - z) ** 2)

class DrawRequest:
    def __init__(self, x, y, z, surf: pygame.Surface):
        self.x = x
        self.y = y
        self.surf = surf
        self.dist_to_camera = dist_to_camera(x, y, z)

    def __lt__(self, other):
        return self.dist_to_camera < other.dist_to_camera

    def __gt__(self, other):
        return self.dist_to_camera > other.dist_to_camera

    def __eq__(self, other):
        return self.dist_to_camera == other.dist_to_camera
    
class Draw:
    __DrawList__: list[DrawRequest] = []
    def render_calls(surf: pygame.Surface):
        Draw.__DrawList__.sort(reverse=False)
        while len(Draw.__DrawList__) != 0:
            item = Draw.__DrawList__.pop()
            surf.blit(item.surf, item.surf.get_rect(center=(item.x, item.y)))
    def add_call(x, y, z, surf: pygame.Surface):
        Draw.__DrawList__.append(DrawRequest(x, y, z, surf))