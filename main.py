import pygame
import math
import asyncio
from settings import *
from entities import Player

# pygame setup
pygame.init()
screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT), pygame.RESIZABLE | pygame.HWSURFACE | pygame.DOUBLEBUF)
displaybuff = pygame.Surface.copy(screen)
floorbuff = pygame.Surface((screen.width * FLOOR_COVERAGE, screen.height * FLOOR_COVERAGE))
clock = pygame.Clock()

async def main():
    # game logic setup
    running = True
    player = Player(32, 32)
    htiles = WINDOW_WIDTH // 32
    vtiles = WINDOW_HEIGHT // 32

    # isometric viewing
    direction = 45
    scale = 0.5
    cameraX = 0
    cameraY = 0

    swipe_speed = [0, 0]

    # textures
    green_tile      = pygame.image.load('sprites/green_tile.png').convert()
    white_tile      = pygame.image.load('sprites/white_tile.png').convert()
    concrete_wall   = pygame.image.load('sprites/concrete_wall_nonshaded.png').convert_alpha()
    computer_table  = pygame.image.load('sprites/computer_table.png').convert_alpha()
    wooden_bar      = pygame.image.load('sprites/wooden_bar.png').convert_alpha()

    textures = [
        concrete_wall,
        computer_table,
        wooden_bar,
    ]

    # x, y, texture index, height, heightnum
    allTiles = [
        # computer tables 
            # row 1
            (0, 3, 1, 0, 10),
            (1, 3, 1, 0, 10),
            (2, 3, 1, 0, 10),
            (3, 3, 1, 0, 10),

        # wooden bars
        (0, 3, 2, 10, 5),
        (1, 3, 2, 10, 5),
        (2, 3, 2, 10, 5),
        (3, 3, 2, 10, 5),
    ]

    # setup floor tile
    for y in range(WINDOW_HEIGHT // 32 * FLOOR_COVERAGE):
        for x in range(math.ceil(WINDOW_WIDTH / 32) * FLOOR_COVERAGE):
            if (abs(x) + abs(y)) % 2 == 0: 
                floorbuff.blit(green_tile, (x * 32, y * 32))
            else:
                floorbuff.blit(white_tile, (x * 32, y * 32))

    # game loop
    while running:
        pygame.display.set_caption(f"FPS: {clock.get_fps()}")
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:
                    # [cos0 -sin0]
                    # [sin0  cos0]
                    # =>
                    # [cos0     sin0]
                    # [-sin0    cos0]
                    winX = pygame.mouse.get_pos()[0] - WINDOW_WIDTH/2 
                    winY = pygame.mouse.get_pos()[1] - WINDOW_HEIGHT/2 
                    winY /= scale
                    wX = player.x + math.cos(math.radians(-direction)) * winX + math.sin(math.radians(-direction)) * winY
                    wY = player.y - math.sin(math.radians(-direction)) * winX + math.cos(math.radians(-direction)) * winY
                    player.calc_movement(wX, wY)

        # moving camera view around
        dmx, dmy = pygame.mouse.get_rel()
        if pygame.mouse.get_pressed()[2]:
            swipe_dir = 1 if pygame.mouse.get_pos()[1] > WINDOW_HEIGHT/2 else -1
            interp = 0.2
            if abs(dmx) <= 0.01:
                interp = 0.05
            swipe_speed[0] = pygame.math.lerp(swipe_speed[0], dmx / 5 * swipe_dir, interp)
            direction += swipe_speed[0]
            if direction >= 360:
                direction -= 360

            interp = 0.2
            if abs(dmy) < 0.01:
                interp = 0.05
            swipe_speed[1] = pygame.math.lerp(swipe_speed[1], dmy / 300, interp)
            scale += swipe_speed[1]
            scale = min(0.75, max(0.3, scale))

        # logic 
        player.movement(allTiles)

        # rendering the player, cameraX & cameraY calculations
        aX = WINDOW_WIDTH/2 - player.x
        aY = WINDOW_HEIGHT/2 - player.y
        cameraX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * aX - math.sin(math.radians(-direction)) * aY
        cameraY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * aX + math.cos(math.radians(-direction)) * aY) * scale

        # floor rotation
        rotated_floor = pygame.transform.scale_by(pygame.transform.rotate(pygame.transform.scale(floorbuff, (screen.get_width() * FLOOR_COVERAGE, screen.get_height() * FLOOR_COVERAGE)), direction), (1, scale))
        displaybuff.blit(
            rotated_floor,
            rotated_floor.get_rect(center=(cameraX, cameraY))
        )

        # rendering a wall
        for wall in allTiles:
            alpha = 255
            wallX = wall[0] * 32 + 16
            wallY = wall[1] * 32 + 16
            dX = wallX - WINDOW_WIDTH/2
            dY = wallY - WINDOW_HEIGHT/2
            displayWallX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * dX - math.sin(math.radians(-direction)) * dY - (WINDOW_WIDTH/2 - cameraX)
            displayWallY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * dX + math.cos(math.radians(-direction)) * dY) * scale - (WINDOW_HEIGHT/2 - cameraY)
            transformed_concrete_wall = pygame.transform.scale_by(pygame.transform.rotate(textures[wall[2]], direction), (1, scale))
            if abs(displayWallX - WINDOW_WIDTH/2) + abs(displayWallY - WINDOW_HEIGHT/2) < 32:
                alpha = 25
            transformed_concrete_wall.set_alpha(alpha)
            for i in range(wall[4]):
                displaybuff.blit(transformed_concrete_wall, transformed_concrete_wall.get_rect(center=(
                    displayWallX, displayWallY - wall[3] * 2 - i * 2)
                    )
                )

        # drawing on screen
        player.blit(displaybuff)
        screen.blit(pygame.transform.scale(displaybuff, (screen.get_width() * ZOOM, screen.get_height() * ZOOM)), (-WINDOW_WIDTH/2 * (ZOOM-1), -WINDOW_HEIGHT/2 * (ZOOM-1)))

        # screen updates
        pygame.display.flip()
        displaybuff.fill((50, 50, 50))
        screen.fill((50, 50, 50))
        clock.tick(FPS)
        await asyncio.sleep(0)

asyncio.run(main())