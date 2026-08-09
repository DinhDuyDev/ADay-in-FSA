# .nttt
# .nwwai
import pygame
import asyncio
import utilityfuncs
from settings import *

class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.goalX = x
        self.goalY = y
        self.hsp = 0
        self.vsp = 0

    def calc_movement(self, gX, gY):
        self.goalX = gX
        self.goalY = gY

        self.hsp = (self.goalX - self.x) / utilityfuncs.dist(self.x, self.y, self.goalX, self.goalY)
        self.vsp = (self.goalY - self.y) / utilityfuncs.dist(self.x, self.y, self.goalX, self.goalY)

    def movement(self, tiles):
        if utilityfuncs.dist(self.x, self.y, self.goalX, self.goalY) > 4:
            self.x += self.hsp
            self.y += self.vsp

        for t in tiles:
            if pygame.Rect(t[0] * 32, t[1] * 32, 32, 32).colliderect(self.x-4 + self.hsp, self.y-4 + self.vsp, 8, 8):
                print("Collision detected!")
                self.hsp = 0
                self.vsp = 0
                break
            else:
                print()

    def blit(self, surface: pygame.Surface):
        pygame.draw.rect(surface, (255, 0, 0), (WINDOW_WIDTH/2-4, WINDOW_HEIGHT/2-4, 8, 8))
