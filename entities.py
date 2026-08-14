# .nttt
# .nwwai
import pygame
import pathfind
import utilityfuncs
from settings import *
import math

class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.real_x = x
        self.real_y = y
        self.dest_x = x
        self.dest_y = y
        self.hsp = 0
        self.vsp = 0
        self.move_path:list[tuple[int, int]] = list()
        self.surface = pygame.Surface((8, 8))
        self.surface.fill((255, 0, 0))
        self.move_speed = 2.5

    def calc_movement(self, gX, gY, tiles):
        self.dest_x = gX
        self.dest_y = gY
        self.move_path.clear()
        self.move_path = pathfind.pathfind(int(self.x / TILESIZE), int(self.y / TILESIZE), int(gX / TILESIZE), int(gY / TILESIZE), tiles)
        if not self.move_path:
            self.dest_x = self.x
            self.dest_y = self.y

    def movement(self):
        if len(self.move_path) == 0:
            if utilityfuncs.dist(self.dest_x, self.dest_y, self.real_x, self.real_y) > 2:
                dir_ = utilityfuncs.point_direction(self.real_x, self.real_y, self.dest_x, self.dest_y)
                self.real_x += math.cos(math.radians(dir_)) * self.move_speed
                self.real_y -= math.sin(math.radians(dir_)) * self.move_speed
            else:
                self.dest_x, self.dest_y = self.real_x, self.real_y
        else:
            x, y = (self.move_path[0][0] * TILESIZE + 16
                        , self.move_path[0][1] * TILESIZE + 16)

            if utilityfuncs.dist(self.real_x, self.real_y, x, y) > 5:
                dir_ = utilityfuncs.point_direction(self.x, self.y, x, y)
                self.front_dir = dir_
                self.real_x += math.cos(math.radians(dir_)) * self.move_speed
                self.real_y -= math.sin(math.radians(dir_)) * self.move_speed
            else:
                self.move_path.pop(0)
        self.x = pygame.math.lerp(self.x, self.real_x, 0.1)
        self.y = pygame.math.lerp(self.y, self.real_y, 0.1)

    def surf(self):
        return self.surface



class NPC:
    def __init__(self, x, y, surf: pygame.Surface, dialogues:list[str]):
        self.x = x
        self.y = y
        self.surface = surf

        self.dialogue:list[str] = dialogues
        self.post_dialogue_action:function = None

        self.real_x = x
        self.real_y = y
        self.dest_x = x
        self.dest_y = y
        self.hsp = 0
        self.vsp = 0
        self.move_path:list[tuple[int, int]] = list()
        # self.surface = pygame.Surface((8, 8))
        # self.surface.fill((255, 0, 0))
        self.move_speed = 2

    def calc_movement(self, gX, gY, tiles):
        self.dest_x = gX
        self.dest_y = gY
        self.move_path.clear()
        self.move_path = pathfind.pathfind(int(self.x / TILESIZE), int(self.y / TILESIZE), int(gX / TILESIZE), int(gY / TILESIZE), tiles)
        if not self.move_path:
            self.dest_x = self.x
            self.dest_y = self.y

    def movement(self):
        if len(self.move_path) == 0:
            if utilityfuncs.dist(self.dest_x, self.dest_y, self.real_x, self.real_y) > 2:
                dir_ = utilityfuncs.point_direction(self.real_x, self.real_y, self.dest_x, self.dest_y)
                self.real_x += math.cos(math.radians(dir_)) * self.move_speed
                self.real_y -= math.sin(math.radians(dir_)) * self.move_speed
            else:
                self.dest_x, self.dest_y = self.real_x, self.real_y
        else:
            x, y = (self.move_path[0][0] * TILESIZE + 16
                        , self.move_path[0][1] * TILESIZE + 16)

            if utilityfuncs.dist(self.real_x, self.real_y, x, y) > 5:
                dir_ = utilityfuncs.point_direction(self.x, self.y, x, y)
                self.front_dir = dir_
                self.real_x += math.cos(math.radians(dir_)) * self.move_speed
                self.real_y -= math.sin(math.radians(dir_)) * self.move_speed
            else:
                self.move_path.pop(0)
        self.x = pygame.math.lerp(self.x, self.real_x, 0.1)
        self.y = pygame.math.lerp(self.y, self.real_y, 0.1)

    def surf(self):
        return self.surface


class Prop:
    def __init__(self, x, y, z, surf: pygame.Surface):
        self.x = x
        self.y = y
        self.z = z
        self.surface = surf

    def surf(self):
        return self.surface