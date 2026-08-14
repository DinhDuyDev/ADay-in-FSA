####### MAKE AUTO TALKING POSSIBLE.
#######
#######
# imports
import pygame
import math
import asyncio
from settings import *

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
textlayer = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT/4.25))
floorbuff = pygame.Surface((screen.width * FLOOR_COVERAGE, screen.height * FLOOR_COVERAGE)).convert_alpha()
clock = pygame.Clock()

#################
# Extra imports #
#################
from entities import *
from draw_order import Draw
import minigames

class GameControl:
    minigame_mode = "order" # order, selection, video edit, character selection
    is_in_minigame = False
    is_in_dialog = False
    track = None
    selection_index = 0
    dialog_index = 0
    sentence_index = 0

async def main():
    # game logic setup
    zoom = 1.5
    running = True
    player = Player(WINDOW_WIDTH * FLOOR_COVERAGE /2, WINDOW_HEIGHT * FLOOR_COVERAGE * 0.75)#Player(48, 48)

    # isometric viewing
    direction = 0
    swipe_speed = [1, 1]
    scale = 0.5
    cameraX = 0
    cameraY = 0
    hcells = int(math.ceil(WINDOW_WIDTH / TILESIZE) * FLOOR_COVERAGE)
    vcells = int(WINDOW_HEIGHT * FLOOR_COVERAGE // TILESIZE)

    click_elasped = 0
    double_clicked = False

    # textures
    green_tile      = pygame.transform.scale(pygame.image.load('sprites/green_tile.png').convert(), (TILESIZE, TILESIZE))
    white_tile      = pygame.transform.scale(pygame.image.load('sprites/white_tile.png').convert(), (TILESIZE, TILESIZE))
    concrete_wall   = pygame.image.load('sprites/concrete_nonshaded.png').convert_alpha()
    computer_table  = pygame.image.load('sprites/computer_table.png').convert_alpha()
    wooden_bar      = pygame.image.load('sprites/wooden_bar.png').convert_alpha()
    chair           = pygame.transform.scale(pygame.image.load('sprites/office_chair.png').convert_alpha(), (48, 48))

    rotation_caches = [
        None,
        None,
        None
    ]

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
    boss = NPC(hcells * TILESIZE / 2, vcells * TILESIZE * 0.75, boss_sprite, None)
    
    teammate1 = NPC(277, 78, boss_sprite, None)
    teammate2 = NPC(497, 528, teammate1_sprite, None)
    all_npcs.append(boss)
    all_npcs.append(teammate1) # lan
    all_npcs.append(teammate2) # hung

    dialogue_tree = [
        [boss, "convo", [
            "Welcome to FSA, new hire!",
            "We look forward to seeing you in office\nand joining FSA as a new family member!",
            "Please make yourself comfortable, as\nwe look forward to seeing you in action!",
            "Today, you will work with: Lan and Hung,\ntwo very dedicated team members of FSA",
            "Now, which who do you\nwant to be for the day?",
            "Instructional designer,\nor E-Learning Developer?"
        ]],
        [boss, "minigame", [
            "Instructional designer,\nor E-Learning Developer?",
            ["Instructional Designer", "E-Learning Developer"], "", "character selection"
        ]],
        [teammate1, "convo", [
            "Chào bạn! Mình là Lan!",
            "Mình là Instructional Designer!",
            "Mình phụ trách xác định mục tiêu học tập,\ncấu trúc khóa học và nội dung đào tạo.",
            "Chào mừng bạn đã đến với FSA!",
            "Hãy cùng mình làm việc nhé!",
            "Hôm nay vừa mở máy thì có tin nhắn\ntừ trưởng phòng Kế toán: ",
            '"Bên mình cần một khoá đào tạo về\nchính sách chi phí mới,"',
            '"Tuần sau ra mắt được không?"',
            "Đính kèm là một file chính sách 12 trang.\n Không có gì thêm.",
            "Đây là khoảnh khắc quen\nthuộc của Instructional Designer:",
            "Ai đó đã tự chẩn\nđoán vấn đề (“cần đào tạo”)",
            "Và tự kê đơn (“một khoá học”).\nViệc của bạn là kiểm tra xem",
            "Chẩn đoán đó có đúng không\ntrước khi bắt tay làm.",
            'Vì việc "cần đào tạo hiếm khi là một vấn đề thật.\n Nó là triệu chứng ai đó nhìn thấy.',
            "Hãy giúp mình sắp xếp công việc cho\nyêu cầu này trong sáng nay luôn nhé.",
        ]],
        [teammate1, "minigame", [
            "Hãy giúp mình sắp xếp công việc cho\nyêu cầu này trong sáng nay luôn nhé." , minigames.order1, minigames.order1_answer, "order"
        ]],
        [teammate1, "convo", [
            "Chính xác!",
            "Người làm nghề lâu năm luôn\nbắt đầu bằng việc HIỂU trước khi DỰNG.",
            "Hỏi người yêu cầu để lộ ra vấn đề thật\n(có khi chỉ cần sửa cái biểu mẫu,\nkhông cần khoá học nào cả).",
            "Rồi mới chốt người học phải làm được gì,\ngặp SME để biết chỗ dễ sai.",
            "Và chỉ khi đó việc dựng\nslide mới có mục tiêu.",
            "Dựng trước tiên là cái bẫy phổ biến nhất:\nbạn sẽ làm rất nhanh một thứ không ai cần.",
        ]],
        [teammate1, "convo", [
            '"Em làm giúp bộ slide đọc là hiểu, chị\ngửi cho cả phòng là được."\nBạn đáp thế nào?',
        ]],
        [teammate1, "minigame", [
            '"Em làm giúp bộ slide đọc là hiểu, chị\ngửi cho cả phòng là được."\nBạn đáp thế nào?', 
            minigames.selection1, minigames.selection1_answer, "selection"
        ]],
        [teammate1, "convo", [
            "Chính xác!",
            "Bạn tách “thứ ai cũng cần làm được”\nkhỏi “thứ tra khi gặp”.",
            "Module chính vẫn gọn quanh mục tiêu:\nngoại lệ nằm trong một job aid tải về.\n",
            "SME vẫn có đủ chỗ cho mọi thứ anh ấy\nlo — chỉ là không phải tất cả nhồi\nvào đầu người học cùng lúc.",
            "Đây là quản lý cognitive load."
            "Cuối ngày, thứ bạn giao không\nphải là “một khoá học”.",
            "Bạn đã: bóc tách một yêu cầu\nmơ hồ, phát hiện vấn đề thật,",
            "Chốt một mục tiêu đo được, dựng\nmột khung tập trung vào luyện tập,",
            "Và bảo vệ người học khỏi\nviệc bị nhồi nhét.",
            "Để ý xem: gần như không\ncó phút nào bạn “làm slide”.",
            "Phần nặng nhất của Instructional Design\nnằm ở suy nghĩ trước khi mở công cụ.",
            "Nó năm ở việc hỏi đúng câu, cắt đúng thứ, và luôn hỏi người học phải LÀM được gì?",
            "Đó là nghề: không phải người tạo nội dung,\nmà là người thiết kế sự thay đổi.",
            "Cảm on bạn vì đã hỗ trợ mình!",
            # put a lunch scene in here
            "Bạn đã làm rất tốt cho một new hire!",
            "Bạn Hùng vừa nhắn tin cho mình,\n, bạn hãy ra hỗ trợ bạn ấy nhé!",
        ]],
    ]

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
                if not GameControl.is_in_dialog:
                    if event.button == 1:
                        if click_elasped < 20:
                            double_clicked = True
                        click_elasped = 0
                else:
                    if not GameControl.is_in_minigame:
                        # if it's in dialog and the dialog ends, skip the dialog
                        if GameControl.sentence_index == len(dialogue_tree[GameControl.dialog_index][2]) - 1:
                            GameControl.sentence_index = 0
                            GameControl.dialog_index += 1
                            display_message_length_count = 0
                        else:
                            GameControl.sentence_index += 1
                            minigames.buffer.clear()
                            display_message_length_count = 0
                    else:
                        mx, my = pygame.mouse.get_pos()
                        if GameControl.minigame_mode in "selection order":
                            if not minigames.buffer:
                                minigames.buffer = [None] * len(dialogue_tree[GameControl.dialog_index][2][2])
                                print(len(minigames.buffer))
                            for choices in dialogue_tree[GameControl.dialog_index][2][1]:
                                mini_text_rect = pygame.Rect(choices.x - WINDOW_WIDTH/2 * 0.6, choices.y, WINDOW_WIDTH * 0.6, 50)
                                if mini_text_rect.collidepoint(mx, my):
                                    if choices.order == -1:
                                        choices.order = GameControl.selection_index
                                        minigames.buffer[GameControl.selection_index] = choices
                                        GameControl.selection_index += 1
                                        
                            if dialogue_tree[GameControl.dialog_index][2][3] == "order":
                                if GameControl.selection_index == len(minigames.buffer):
                                    if minigames.buffer == dialogue_tree[GameControl.dialog_index][2][2]:
                                        GameControl.is_in_minigame = False
                                        minigames.buffer.clear()
                                        GameControl.dialog_index += 1
                                        GameControl.sentence_index = 0
                                        display_message_length_count = 0

                                    else:
                                        for choice in dialogue_tree[GameControl.dialog_index][2][1]:
                                            choice.order = -1
                                    GameControl.selection_index = 0
                            elif dialogue_tree[GameControl.dialog_index][2][3] == "selection":
                                if GameControl.selection_index == 1:
                                    if minigames.buffer[0].text in dialogue_tree[GameControl.dialog_index][2][2]:
                                        GameControl.is_in_minigame = False
                                        GameControl.dialog_index += 1
                                        GameControl.sentence_index = 0
                                        display_message_length_count = 0
                                        minigames.buffer.clear()
                                    else:
                                        for choice in dialogue_tree[GameControl.dialog_index][2][1]:
                                            choice.order = -1
                                    GameControl.selection_index = 0

                        elif GameControl.minigame_mode == "character selection":
                            y_offset = 200
                            for i in range(len(dialogue_tree[GameControl.dialog_index][2][1])):
                                collision_rect = pygame.Rect(WINDOW_WIDTH * 0.2, y_offset, WINDOW_WIDTH * 0.6, 200)
                                if collision_rect.collidepoint(mx, my):
                                    GameControl.track = i
                                    teammates = [teammate1, teammate2]
                                    player.calc_movement(teammates[i].x, teammates[i].y, geometry)
                                    GameControl.is_in_minigame = False
                                    GameControl.selection_index = 0
                                    GameControl.dialog_index = 2 + i
                                    display_message_length_count = 0
                                y_offset += 200
                            
        if double_clicked and not EDIT_MODE:
            winX = (pygame.mouse.get_pos()[0] - WINDOW_WIDTH/2) / zoom
            winY = (pygame.mouse.get_pos()[1] - WINDOW_HEIGHT/2) / zoom - UP_OFFSET
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


        ###################
        # TEXTURE CACHING #
        ###################
        if abs(swipe_speed[0] + swipe_speed[1]) > 0:
            for idx, texture in enumerate(textures):
                z = 0
                height = 0
                if idx == 0: height = 20
                elif idx == 1: height = 10
                else:
                    height = 5
                    z = 10
                transformed_wall = pygame.transform.scale_by(pygame.transform.rotate(texture, direction), (1, scale))
                draw_surface = pygame.Surface((transformed_wall.width, transformed_wall.height * (height + z) * 2)).convert_alpha()
                draw_surface.fill((0, 0, 0, 0))

                for i in range(height):
                    draw_surface.blit(
                        transformed_wall,
                        transformed_wall.get_rect(center=(draw_surface.get_width()/2, draw_surface.get_height()/2 - z * 4 - i * 2))
                    )
                rotation_caches[idx] = draw_surface

        #############
        # EDIT MODE #
        #############
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
        if not GameControl.is_in_dialog:
            player.movement()

        # rendering the player, cameraX & cameraY calculations
        aX = WINDOW_WIDTH/2 - player.x
        aY = WINDOW_HEIGHT/2 - player.y
        cameraX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * aX - math.sin(math.radians(-direction)) * aY
        cameraY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * aX + math.cos(math.radians(-direction)) * aY) * scale


        # asking for help in conversations
        next_npc = dialogue_tree[GameControl.dialog_index][0]
        if utilityfuncs.dist(player.x, player.y, next_npc.x, next_npc.y) < 16:
            if dialogue_tree[GameControl.dialog_index][1] == "convo":
                GameControl.is_in_dialog = True
            elif dialogue_tree[GameControl.dialog_index][1] == "minigame":
                GameControl.is_in_minigame = True
                GameControl.minigame_mode = dialogue_tree[GameControl.dialog_index][2][3]
        else:
            GameControl.is_in_dialog = False
            GameControl.is_in_minigame = False
            display_message_length_count = 0

        # floor rotation
        rotated_floor = pygame.transform.scale_by(pygame.transform.rotate(pygame.transform.scale(floorbuff, (screen.get_width() * FLOOR_COVERAGE, screen.get_height() * FLOOR_COVERAGE)), direction), (1, scale))
        fX = floorbuff.get_width()/2 - player.x
        fY = floorbuff.get_height()/2 - player.y
        displayFloorX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * fX - math.sin(math.radians(-direction)) * fY
        displayFloorY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * fX + math.cos(math.radians(-direction)) * fY) * scale + UP_OFFSET
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
            displayWallY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * dX + math.cos(math.radians(-direction)) * dY) * scale - (WINDOW_HEIGHT/2 - cameraY) + UP_OFFSET

            if -64 > displayWallX or WINDOW_WIDTH + 64 < displayWallX or -64 > displayWallY or WINDOW_HEIGHT + 64 < displayWallY:
                continue

            if wall[2] == 0 and displayWallY > WINDOW_HEIGHT/2 + UP_OFFSET:
                continue

            
            draw_surface = rotation_caches[wall[2]]
            Draw.add_call(displayWallX, displayWallY + wall[3] * 2, wall[3] + wall[4], draw_surface)

        ###############
        # Player draw #
        ###############
        Draw.add_call(WINDOW_WIDTH/2, WINDOW_HEIGHT/2 + UP_OFFSET, 0, player.surf())

        #################
        # NPC rendering #
        #################
        for npc in all_npcs:
            npc.movement()
            nX = npc.x - player.x
            nY = npc.y - player.y
            displayNPCX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * nX - math.sin(math.radians(-direction)) * nY
            displayNPCY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * nX + math.cos(math.radians(-direction)) * nY) * scale + UP_OFFSET
            Draw.add_call(displayNPCX, displayNPCY - npc.surf().height/2, 20, npc.surf())

        ##################
        # Prop rendering #
        ##################
        for prop in all_props:
            pX = prop.x - player.x
            pY = prop.y - player.y
            propX = WINDOW_WIDTH/2 + math.cos(math.radians(-direction)) * pX - math.sin(math.radians(-direction)) * pY 
            propY = WINDOW_HEIGHT/2 + (math.sin(math.radians(-direction)) * pX + math.cos(math.radians(-direction)) * pY) * scale + UP_OFFSET
            Draw.add_call(propX, propY - prop.surf().get_height()/2, 20, prop.surf())


        ####################
        # drawing on screen
        Draw.render_calls(displaybuff)

        ###############################
        # Drawing on screen (Finally) #
        ###############################
        screen.blit(pygame.transform.scale(displaybuff, (screen.get_width() * zoom, screen.get_height() * zoom)), (-WINDOW_WIDTH/2 * (zoom-1), -WINDOW_HEIGHT/2 * (zoom-1)))

        ########################
        # Conversation machine #
        ########################
        if GameControl.is_in_dialog:
            # message display
            display_message_offset = pygame.math.lerp(display_message_offset, 255, 0.1)
            if display_message_length_count < len(dialogue_tree[GameControl.dialog_index][2][GameControl.sentence_index]):
                display_message_length_count += 1
            display_message = dialogue_tree[GameControl.dialog_index][2][GameControl.sentence_index][0:int(display_message_length_count)]
            text_surf = font.render(display_message, False, (255, 0, 0))
            portrait = pygame.transform.scale(teammate1_portrait, (32, 28))
            # mini game
            if GameControl.is_in_minigame:
                if GameControl.track == 0:
                    direction = pygame.math.lerp(direction, 160, 0.1)
                    zoom = pygame.math.lerp(zoom, 12, 0.1)
                display_message_length_count = len(dialogue_tree[GameControl.dialog_index][2][GameControl.sentence_index])
                if GameControl.minigame_mode in "selection order":
                    for text in dialogue_tree[GameControl.dialog_index][2][1]:
                        txt = text.text
                        if text.order != -1:
                            txt += f"({text.order+1})"
                        mini_text_surf = font.render(txt, False, (255, 0, 0))
                        mini_text_rect = pygame.Rect(text.x - WINDOW_WIDTH/2 * 0.8, text.y, WINDOW_WIDTH * 0.8, 50)
                        pygame.draw.rect(screen, (0, 255, 0), mini_text_rect)
                        screen.blit(mini_text_surf, mini_text_rect)

                elif GameControl.minigame_mode == "character selection":
                    y_offset = 200
                    for text in dialogue_tree[GameControl.dialog_index][2][1]:
                        mini_text_surf = font.render(text, False, (255, 0, 0))
                        mini_text_rect = mini_text_surf.get_rect(midtop=(WINDOW_WIDTH/2, y_offset))
                        screen.blit(mini_text_surf, mini_text_rect)
                        y_offset += 200


            # text layer
            textlayer.fill((255, 255, 255))
            textlayer.blit(portrait, portrait.get_rect(topleft=(32,32)))
            textlayer.blit(text_surf, text_surf.get_rect(topleft=(32, 80)))

            # conversation effects
            textlayer.set_alpha(display_message_offset)
            screen.blit(textlayer)
            zoom = pygame.math.lerp(zoom, 3, 0.1)

        else:
            display_message_offset = pygame.math.lerp(display_message_offset, 0, 0.2)
            zoom = pygame.math.lerp(zoom, 1.5, 0.1)

        #################
        # screen updates
        pygame.display.flip()
        displaybuff.fill((50, 50, 50))
        screen.fill((50, 50, 50))
        clock.tick(FPS)
        await asyncio.sleep(0)

asyncio.run(main())