import math

class Node:
    def __init__(self, x, y, g, h):
        self.x = x
        self.y = y
        self.g = g # g-cost: from base node to this node
        self.h = h # h-cost: from target node to this node
        self.f = g + h # f-cost: g + h

    def __lt__(self, other):
        return self.f < other.f
    def __gt__(self, other):
        return self.f > other.f
    def __str__(self):
        return f"[{self.x}, {self.y}, {int(self.g)}, {int(self.h)}, {int(self.f)}]"

def min_node(ls):
    m = ls[0]
    for i in ls:
        if m > i:
            m = i
    return m

def find_dist(x, y, x1, y1):
    return math.sqrt((x1 - x)**2 + (y1 - y)**2) * 10

def pathfind(x, y, x1, y1, mat):
    if mat[y1][x1] == 1:
        print("wall!!")
        return []
    neighborhood = {
        (-1, -1), (0, -1), (1, -1),
        (-1, 0), (1, 0),
        (-1, 1), (0, 1), (1, 1)
    }
    matrix_width = len(mat[0])
    matrix_height = len(mat)

    # print(matrix_width, matrix_height, ":", x, y)
    nodes_matrix:list[list[Node]] = []

    for i in range(matrix_height):
        ls = []
        for j in range(matrix_width):
            ls.append(Node(j, i, 0, 0))
        nodes_matrix.append(ls)

    start_node = nodes_matrix[y][x]
    targ_node = nodes_matrix[y1][x1]
    mapped_matrix = dict()
    new = set()
    closed = set()

    new.add(start_node)
    curr_node = None
    while curr_node is not targ_node:
        curr_node = min(new)
        new.remove(curr_node)
        closed.add(curr_node)

        for (dx, dy) in neighborhood:
            # Traversability and belonging in closed
            not_in_bound = not(0 <= curr_node.x+dx < matrix_width and 0 <= curr_node.y+dy < matrix_height)
            if not_in_bound:
                continue

            in_closed = nodes_matrix[curr_node.y+dy][curr_node.x+dx] in closed
            if in_closed:
                continue

            non_traversable = mat[curr_node.y+dy][curr_node.x+dx] != 0#not in tiles.TRAVERSABLE_TILES
            n = mat[curr_node.y+dy][curr_node.x+dx]
            if n == 6 and n == 1:
                print("6 is traversable")
            if non_traversable:
                continue

            n = nodes_matrix[curr_node.y+dy][curr_node.x+dx]
            g = curr_node.g + find_dist(curr_node.x, curr_node.y, n.x, n.y)
            h = find_dist(x1, y1, n.x, n.y)
            f = g + h
            if n.f > f or n not in new:
                n.f = f
                n.g = g
                n.h = h
                mapped_matrix[n] = curr_node
                if n not in new:
                    new.add(n)

    # Retracing path
    # print("Finished processing!")
    # print("Retracing map...")
    # print("Start:\t", start_node)
    # print("End:\t", targ_node)
    # for k, v in mapped_matrix.items():
        # print(k, '\t', v)

    # print("-------------------")
    c_node = targ_node
    results_list = []
    while c_node is not start_node:
        # print_mat(matrix)
        # mat[c_node.y][c_node.x] = 2
        # print(c_node, '\t',mapped_matrix[targ_node])
        results_list.insert(0,(c_node.x
                                   , c_node.y
                               ))
        c_node = mapped_matrix[c_node]
    # print_mat (mat)
    # print(len(results_list))
    return results_list