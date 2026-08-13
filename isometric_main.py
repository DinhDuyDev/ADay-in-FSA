# imports
import pygame
import math
import asyncio
from settings import *
from entities import *
from draw_order import Draw

# pygame setup
pygame.init()
pygame.font.init()

# screen & rendering setup
screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT), pygame.HWSURFACE | pygame.DOUBLEBUF, pygame.SRCALPHA)
font = pygame.font.SysFont("Arial", 16, bold=True)
pygame.display.set_caption("A Day in FSA.STIL by DuyND79")
icon = pygame.image.load('sprites/logo.jpeg')
pygame.display.set_icon(icon)
displaybuff = pygame.Surface.copy(screen)
floorbuff = pygame.Surface((screen.width * FLOOR_COVERAGE, screen.height * FLOOR_COVERAGE)).convert_alpha()
clock = pygame.Clock()

#############
#  STAGES   #
# lan, hung #
#############

async def main():
    # game logic setup
    running = True
    player = Player(48, 48)

    # isometric viewing
    direction = 0
    swipe_speed = [0, 0]
    scale = 0.5
    cameraX = 0
    cameraY = 0
    hcells = int(math.ceil(WINDOW_WIDTH / TILESIZE) * FLOOR_COVERAGE)
    vcells = int(WINDOW_HEIGHT // TILESIZE * FLOOR_COVERAGE)

    click_elasped = 0
    double_clicked = False

    # textures
    green_tile      = pygame.transform.scale(pygame.image.load('sprites/green_tile.png').convert(), (TILESIZE, TILESIZE))
    white_tile      = pygame.transform.scale(pygame.image.load('sprites/white_tile.png').convert(), (TILESIZE, TILESIZE))
    concrete_wall   = pygame.image.load('sprites/concrete_nonshaded.png').convert_alpha()
    computer_table  = pygame.image.load('sprites/computer_table.png').convert_alpha()
    wooden_bar      = pygame.image.load('sprites/wooden_bar.png').convert_alpha()
    chair           = pygame.transform.scale(pygame.image.load('sprites/office_chair.png').convert_alpha(), (48, 48))

    textures = [
        concrete_wall,
        computer_table,
        wooden_bar,
    ]

    # display message
    display_message = ""
    display_message_length_count = 0
    display_message_offset = 0

    all_props: list[Prop] = []

    def put_wooden_bars():
        bars = []
        for i in allTiles:
            if i[2] == 1:
                bars.append((i[0], i[1], 2, 10, 5))
        allTiles.extend(bars)

    def put_walls():
        for y in range(vcells):
            for x in range(hcells):
                if x == 0 or x == hcells-1 or y == 0 or y == vcells-1:
                    allTiles.append((x, y, 0, 0, 20))

    def put_chairs():
        for tile in allTiles:
            if tile[2] == 1:
                all_props.append(Prop(tile[0] * TILESIZE + 16, (tile[1]-1) * TILESIZE + 16, -10, chair))

    put_chairs()
    put_wooden_bars()
    put_walls()

    ############
    # GEOMETRY #
    ############
    geometry: list[list[int]] = [[0 for x in range(hcells)] for y in range(vcells)]
    for tile in allTiles:
        geometry[tile[1]][tile[0]] = 1

    ############
    # ENTITIES #
    ############
    boss_sprite = pygame.transform.scale_by(pygame.image.load('sprites/prajith.png').convert_alpha(), 2)
    teammate1_sprite = pygame.transform.scale_by(pygame.image.load('sprites/lan.png').convert_alpha(), 2)
    teammate1_portrait = pygame.transform.scale_by(pygame.image.load('sprites/lan_portrait.png').convert_alpha(), 2)
    all_npcs:list[NPC] = []

    ##########
    # SCRIPT #
    ##########

    ## First we will add our boss to the game first
    boss = NPC(hcells * TILESIZE / 2, vcells * TILESIZE * 0.75, boss_sprite, [
        "Welcome to FSA, new hire!",
        "We look forward to seeing you in office\nand joining FSA as a new family member!",
        "Please make yourself comfortable, as\nwe look forward to seeing you in action!",
        "Today, you will work with: Lan and Hung,\ntwo very dedicated team members of FSA",
        "Firstly, please find Lan in the office\nat the back for some starter work.\nHave a nice day!"
        ])
    
    teammate1 = NPC(272, 78, boss_sprite, None)
    teammate2 = NPC(112, 208, boss_sprite, None)
    teammate3 = NPC(497, 528, boss_sprite, None)
    all_npcs.append(boss)
    all_npcs.append(teammate1) # lan
    all_npcs.append(teammate2) # hung
    all_npcs.append(teammate3) # hoa

    def give_teammate1_dialogue():
        teammate1.dialogue = [
            "Chào bạn! Mình là Lan!",
            "Mình là Instructional Designer!",
            "Mình phụ trách xác định mục tiêu học tập,\ncấu trúc khóa học và nội dung đào tạo.",
            "Chào mừng bạn đã đến với FSA!",
        ]

    boss.post_dialogue_action = give_teammate1_dialogue

    # setup floor tile
    for y in range(vcells):
        for x in range(hcells):
            if (abs(x) + abs(y)) % 2 == 0: 
                floorbuff.blit(green_tile, (x * TILESIZE, y * TILESIZE))
            else:
                floorbuff.blit(white_tile, (x * TILESIZE, y * TILESIZE))

    # game loop
    while running:
        if DEBUG:
            pygame.display.set_caption(f"FPS: {clock.get_fps()}")
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if not player.conversation_partner:
                    if event.button == 1:
                        if click_elasped < 20:
                            double_clicked = True
                        click_elasped = 0
                else:
                    if player.conversation_partner.dialogue:
                        if len(display_message) / len(player.conversation_partner.dialogue[0]) >= 1.0:
                            player.conversation_partner.dialogue.pop(0)
                            display_message_length_count = 0                    
                    else:
                        player.conversation_partner = None
                        display_message_length_count = 0

        if double_clicked and not EDIT_MODE:
            winX = (pygame.mouse.get_pos()[0] - WINDOW_WIDTH/2) / ZOOM
            winY = (pygame.mouse.get_pos()[1] - WINDOW_HEIGHT/2) / ZOOM
            winY /= scale
            wX = player.x + math.cos(math.radians(-direction)) * winX + math.sin(math.radians(-direction)) * winY
            wY = player.y - math.sin(math.radians(-direction)) * winX + math.cos(math.radians(-direction)) * winY
            player.calc_movement(wX, wY, geometry)
            double_clicked = False

        #########
        # LOGIC #
        #########
        # moving camera view around
        dmx, dmy = pygame.mouse.get_rel()
        # scale = 1
        click_elasped += 1
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

        if EDIT_MODE:
            if pygame.mouse.get_pressed()[0]:
                mX, mY = pygame.mouse.get_pos()
                mX, mY = int(mX/TILESIZE), int(mY/TILESIZE)
                if not geometry[mY][mX]:
                    geometry[mY][mX] = 1
                    allTiles.append((mX, mY, 1, 0, 10))
            elif pygame.mouse.get_pressed()[2]:
                mX, mY = pygame.mouse.get_pos()
                mX, mY = int(mX/TILESIZE), int(mY/TILESIZE)
                geometry[mY][mX] = 0
                for tile in allTiles:
                    if tile[0] == mX and tile[1] == mY:
                        allTiles.remove(tile)

        # Player movement
        if not player.conversation_partner:
            player.movement()

        # rendering the player, cameraX & cameraY calculations
        aX = WINDOW_WIDTH/2 - player.x
        aY = WINDOW_HEIGHT/2 - player.y
        cameraX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * aX - math.sin(math.radians(-direction)) * aY
        cameraY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * aX + math.cos(math.radians(-direction)) * aY) * scale

        
        # asking for help in conversations
        for npc in all_npcs:
            if utilityfuncs.dist(player.x, player.y, npc.x, npc.y) < 16:
                if npc.dialogue:
                    player.conversation_partner = npc

        ##########
        # SCRIPT #
        ##########
        if utilityfuncs.dist(player.x, player.y, boss.x, boss.y) < 8:
            pass

        # floor rotation
        rotated_floor = pygame.transform.scale_by(pygame.transform.rotate(pygame.transform.scale(floorbuff, (screen.get_width() * FLOOR_COVERAGE, screen.get_height() * FLOOR_COVERAGE)), direction), (1, scale))
        fX = floorbuff.get_width()/2 - player.x
        fY = floorbuff.get_height()/2 - player.y
        displayFloorX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * fX - math.sin(math.radians(-direction)) * fY
        displayFloorY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * fX + math.cos(math.radians(-direction)) * fY) * scale
        displaybuff.blit(
            rotated_floor,
            rotated_floor.get_rect(center=(displayFloorX, displayFloorY))
        )

        ###################
        # RENDERING TILES #
        ###################

        for wall in allTiles:
            alpha = 255
            wallX = wall[0] * TILESIZE + TILESIZE/2
            wallY = wall[1] * TILESIZE + TILESIZE/2
            dX = wallX - WINDOW_WIDTH/2
            dY = wallY - WINDOW_HEIGHT/2
            displayWallX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * dX - math.sin(math.radians(-direction)) * dY - (WINDOW_WIDTH/2 - cameraX)
            displayWallY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * dX + math.cos(math.radians(-direction)) * dY) * scale - (WINDOW_HEIGHT/2 - cameraY)

            if -64 > displayWallX or WINDOW_WIDTH + 64 < displayWallX or -64 > displayWallY or WINDOW_HEIGHT + 64 < displayWallY:
                continue

            if wall[2] == 0 and displayWallY > WINDOW_HEIGHT/2:
                continue

            transformed_wall = pygame.transform.scale_by(pygame.transform.rotate(textures[wall[2]], direction), (1, scale))
            draw_surface = pygame.Surface((transformed_wall.width, transformed_wall.height * (wall[3] + wall[4]) * 2)).convert_alpha()
            draw_surface.fill((0, 0, 0, 0))

            for i in range(wall[4]):
                draw_surface.blit(
                    transformed_wall,
                    transformed_wall.get_rect(center=(draw_surface.get_width()/2, draw_surface.get_height()/2 - wall[3] * 4 - i * 2))
                )
                
            if abs(displayWallX - WINDOW_WIDTH/2) + abs(displayWallY - WINDOW_HEIGHT/2) < 16:
                alpha = 25
            draw_surface.set_alpha(alpha)
            Draw.add_call(displayWallX, displayWallY + wall[3] * 2, wall[3] + wall[4], draw_surface)

        ##############
        # player draw
        Draw.add_call(WINDOW_WIDTH/2, WINDOW_HEIGHT/2 + UP_OFFSET, 0, player.surf())

        #################
        # NPC rendering #
        #################
        for npc in all_npcs:
            nX = npc.x - player.x
            nY = npc.y - player.y
            displayNPCX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * nX - math.sin(math.radians(-direction)) * nY
            displayNPCY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * nX + math.cos(math.radians(-direction)) * nY) * scale
            Draw.add_call(displayNPCX, displayNPCY - npc.surf().height/2, 20, npc.surf())



        ##################
        # Prop rendering #
        ##################
        for prop in all_props:
            pX = prop.x - player.x
            pY = prop.y - player.y
            propX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * pX - math.sin(math.radians(-direction)) * pY 
            propY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * pX + math.cos(math.radians(-direction)) * pY) * scale 
            Draw.add_call(propX, propY - prop.surf().get_height()/2, 20, prop.surf())


        ####################
        # drawing on screen
        Draw.render_calls(displaybuff)

        ###############################
        # Drawing on screen (Finally) #
        ###############################
        screen.blit(pygame.transform.scale(displaybuff, (screen.get_width() * ZOOM, screen.get_height() * ZOOM)), (-WINDOW_WIDTH/2 * (ZOOM-1), -WINDOW_HEIGHT/2 * (ZOOM-1) + UP_OFFSET))

        #####################
        # Experimental text #
        #####################
        if player.conversation_partner and player.conversation_partner.dialogue:
            display_message_offset = pygame.math.lerp(display_message_offset, 0, 0.2)
            convo_partner = player.conversation_partner
            if display_message_length_count < len(convo_partner.dialogue[0]):
                display_message_length_count += 0.5
            display_message = convo_partner.dialogue[0][0:int(display_message_length_count)]
            text_surf = font.render(display_message, False, (255, 0, 0))
            portrait = pygame.transform.scale(teammate1_portrait, (32, 32))
            screen.blit(portrait, portrait.get_rect(topleft=(32,32 - display_message_offset)))
            screen.blit(text_surf, text_surf.get_rect(topleft=(32, 80 - display_message_offset)))
            if convo_partner.post_dialogue_action:
                convo_partner.post_dialogue_action()
        else:
            display_message_offset = pygame.math.lerp(display_message_offset, -128, 0.2)

        #################
        # screen updates
        pygame.display.flip()
        displaybuff.fill((50, 50, 50))
        screen.fill((50, 50, 50))
        clock.tick(FPS)
        await asyncio.sleep(0)

asyncio.run(main())
