# Koshi's Quest
This document describes the gameplay of a game called Koshi's Quest. The protagonist of the game is Koshi the cat, a grey tabby cat with a white stripe on his nose, in his quest to save the world from evil AI robots. The game is to be written in JavaScript and accessible as a web app hosted in GitHub pages.

## Gameplay

### Overview
Koshi is controlled by clicking locations on one of any of the "bricks" on the screen. Koshi then immediately begins traveling directly towards the specific location clicked on the brick. Bricks have a cooldown phase before Koshi can be triggered to move towards any point of the same brick once again. Koshi stops when he touches any brick. The player is able to redirect Koshi while he is still in movement by simply clicking another available brick before he stops due to touching a brick.

The game is level-based, with multiple worlds split into individual levels. Most levels are defined to last a precise amount of time, with various events/triggers designed to occur at specific times. The objective to win each level varies. Conditions for victory in the level consist of:

1. Collecting enough food before time runs out
2. Destroying enough enemies before time runs out
3. Simply survive until the time runs out
4. Defeat the boss (no timer is used on bosses)

### Koshi
Koshi is a circular cat head who is grey with dark grey stripes, a white stripe on his nose, and two pointy ears. He is smiling and has 4 large whiskers poking out from either side of his face.

### Level Layout
The key object of each level are the brick which for most levels make up the boundary of the rectangular grid of the level and sometimes some bricks are placed in the center of the level board as well.

The top of the screen holds locations for the following information:

1. Timer - a clock icon followed by a countdown of seconds remaining in the level. If no timer is used in the level, an infinity symbol is used
2. Level number - Each level has an identifier of the form "1-1", "2-3", etc. for "World 1 Level 1" and "World 2 Level 3", respectively
3. Food count - a chicken leg icon followed by a counter of how much food Koshi has consumed in this level
4. Enemy count - an evil face icone followed by a counter of how many enemies Koshi has destroyed this level
5. Objective - level objective
6. Life Meter - Koshi has 3 hearts. If he touches an enemy, a heart is lost.

### Food
Food randomly appears throughout the level. Food often appears in groups and placed along straight lines so that Koshi may grab them all if he travels along that line. Different foods give Koshi different counts towards his food counters, according to the following table (note the abbreviations for the food will be used in outlining the levels):

|Food       | Counter   | Abbreviation|
|-----------|-----------|-------------|
|Strawberry | 1         | S           |
|Pretzel    | 2         | P           |
|Banana     | 3         | B           |
|Cheese     | 4         | C           |
|Chicken Leg| 5         | L           |
|Fish       | 6         | F           |
|Hamburger  | 7         | H           |

Food can appear in the following methods (note the abbreviations for the method will be used in outlining the levels):

| Method                | Description                                                | Abbrevation |
|-----------------------|------------------------------------------------------------|-------------|
| Solo                  | Appears by itself                                          | S           |
| Line of X             | Appears in straight line with X food                       | LX          |
| Circle of X           | Appears equally spaced along boundary of circle with X food| CX          |
| Random X              | Appears randomly across game board with X food             | RX          |

Note that food can only appear in locations where Koshi has access. Food does not appear on top of bricks.

Food will only remain on the screen for a limited amount of time. A timer bar will appear above the food when it appears and will decrease to indicate how long until the food disappears.

## Bricks
Bricks are colored based on their classification and can be clicked to move Koshi towards the precise location clicked on the brick. At this time, the brick becomes temporarily unclickable and turns a darker shade of color. The bricks have a cooldown time before they are once again clickable. A meter appears along the length of the brick which indicates how much longer the cooldown period is to last. Once the cooldown period is over, the brick returns to its original shade and is once again clickable.

The bricks have the following classifications based on their cooldown time:

| Classification        | Cooldown Time (seconds) | Color |
|-----------------------|-------------------------|-------|
| Slow                  | 15                      | Blue  |
| Normal                | 8                       | Green |
| Fast                  | 3                       | Red   |

## Enemies
Enemies are not yet added into the game.

## Death
Koshi dies if he either runs out of hearts or if he runs off of the edge of the screen.

### World 1

#### Level 1-1
This level has the following:

1. Level time length: 60 seconds
2. Level objective: Gather 20 food
3. Level setup: Bricks along just boundary of screen. Most bricks are Normal speed but one each of Slow and Fast are included.

The food will appear at the following times ("Appear Time") in the following methods using the abbreviations defined above and only stay on screen for the following time in seconds ("Life Time"):
| Appear Time  | Method | Food | Life Time |
|--------------|--------|------|-----------|
| 2            | S      |S     | 5         |
| 4            | S      |S     | 5         |
| 6            | S      |S     | 5         |
| 10           | L3     |S     | 5         |
| 15           | L3     |S     | 5         |
| 20           | L3     |S     | 5         |
| 25           | C3     |S     | 5         |
| 30           | C4     |S     | 5         |
| 35           | C5     |S     | 5         |
| 35           | R5     |P     | 3         |
| 45           | R5     |P     | 3         |
| 55           | R5     |P     | 3         |



