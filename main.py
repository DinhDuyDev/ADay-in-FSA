# imports
import pygame
import math
import asyncio
from settings import *
from entities import *
from draw_order import Draw

# shift focus -> Tomodachi Life characters & no isometric views.

# pygame setup
pygame.init()
pygame.font.init()

# screen & rendering setup
screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT), pygame.HWSURFACE | pygame.DOUBLEBUF, pygame.SRCALPHA)
font = pygame.font.SysFont("Arial", 16, bold=True)
pygame.display.set_caption("A Day in FSA.STIL by DuyND79")
icon = pygame.image.load('sprites/logo.jpeg')
pygame.display.set_icon(icon)
WINDOW_WIDTH = 360
WINDOW_HEIGHT = 640
displaybuff = pygame.transform.scale(pygame.Surface.copy(screen), (WINDOW_WIDTH, WINDOW_HEIGHT))
floorbuff = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT)).convert_alpha()
clock = pygame.Clock()

#############
#  STAGES   #
# lan, hung #
#############

async def main():
    # game logic setup
    running = True
    # player = Player(32, 32)
    player = Player(WINDOW_WIDTH/2, WINDOW_HEIGHT * 0.75)

    # isometric viewing
    cameraX = 0
    cameraY = 0
    hcells = int(math.ceil(WINDOW_WIDTH / TILESIZE))
    vcells = int(WINDOW_HEIGHT // TILESIZE)

    print(hcells, vcells)

    click_elasped = 0
    double_clicked = False

    # textures
    green_tile      = pygame.transform.scale(pygame.image.load('sprites/green_tile_new.png').convert(), (TILESIZE, TILESIZE))
    white_tile      = pygame.transform.scale(pygame.image.load('sprites/white_tile_new.png').convert(), (TILESIZE, TILESIZE))
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
    all_npcs:list[NPC] = []

    ##########
    # SCRIPT #
    ##########

    ## First we will add our boss to the game first
    # boss = NPC(hcells * TILESIZE / 2, vcells * TILESIZE * 0.75, boss_sprite, [
    #     "Welcome to FSA, new hire!",
    #     "We look forward to seeing you in office\nand joining FSA as a new family member!",
    #     "Please make yourself comfortable, as\nwe look forward to seeing you in action!",
    #     "Today, you will work with: Lan and Hung,\ntwo very dedicated team members of FSA",
    #     "Firstly, please find Lan in the office\nat the back for some starter work.\nHave a nice day!"
    #     ])
    boss = NPC(hcells * TILESIZE / 2, vcells * TILESIZE * 0.75, boss_sprite, [])
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
            winX = pygame.mouse.get_pos()[0]
            winY = pygame.mouse.get_pos()[1]
            if (0 < int(winX/TILESIZE) < hcells and 0 < int(winY/TILESIZE) < vcells):
                player.calc_movement(winX, winY, geometry)
            double_clicked = False

        #########
        # LOGIC #
        #########

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

        # rendering the player, cameraX & cameraY calculations
        cameraX = 0
        cameraY = 0
        displaybuff.blit(
            floorbuff, floorbuff.get_rect(center=(WINDOW_WIDTH/2 - cameraX, WINDOW_HEIGHT/2 - UP_OFFSET - cameraY))
        )

        ###################
        # RENDERING TILES #
        ###################

        for wall in allTiles:
            alpha = 255
            wallX = wall[0] * TILESIZE + TILESIZE/2
            wallY = wall[1] * TILESIZE + TILESIZE/2

            transformed_wall = pygame.transform.scale(textures[wall[2]], (TILESIZE, TILESIZE))

            transformed_wall.set_alpha(alpha)
            Draw.add_call(wallX, wallY, 0, transformed_wall)

        ###############
        # player draw #
        ###############
        Draw.add_call(player.x, player.y, 0, player.surf())

        #################
        # NPC rendering #

        for npc in all_npcs:
            Draw.add_call(npc.x, npc.y - npc.surf().height/2, 15, npc.surf())

        ##################
        # Prop rendering #
        ##################
        # for prop in all_props:
        #     pX = prop.x - WINDOW_WIDTH/2 * FLOOR_COVERAGE
        #     pY = prop.y - WINDOW_HEIGHT/2 * FLOOR_COVERAGE
        #     propX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * pX - math.sin(math.radians(-direction)) * pY - (WINDOW_WIDTH/2 - cameraX)
        #     propY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * pX + math.cos(math.radians(-direction)) * pY) * scale - (WINDOW_HEIGHT/2 - cameraY)
        #     Draw.add_call(propX, propY - prop.surf().height/2, 0, prop.surf())


        ####################
        # drawing on screen
        Draw.render_calls(displaybuff)

        ###############################
        # Drawing on screen (Finally) #
        ###############################
        screen.blit(pygame.transform.scale(displaybuff, (screen.get_width(), screen.get_height())), (0,0))

        #####################
        # Experimental text #
        #####################
        if player.conversation_partner and player.conversation_partner.dialogue:
            convo_partner = player.conversation_partner
            if display_message_length_count < len(convo_partner.dialogue[0]):
                display_message_length_count += 0.5
            display_message = convo_partner.dialogue[0][0:int(display_message_length_count)]
            text_surf = font.render(display_message, False, (255, 0, 0))
            screen.blit(text_surf, text_surf.get_rect(topleft=(32, 32)))
            if convo_partner.post_dialogue_action:
                convo_partner.post_dialogue_action()

        #################
        # screen updates
        pygame.display.flip()
        displaybuff.fill((50, 50, 50))
        screen.fill((50, 50, 50))
        clock.tick(FPS)
        await asyncio.sleep(0)

    for tile in allTiles:
        if tile[2] != 0:
            print((tile[0]+1, tile[1]) + (tile[2], tile[3], tile[4]), ",")

asyncio.run(main())
