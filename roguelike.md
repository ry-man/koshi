# Roguelike Mode
This document describes a secondary play mode for Koshi's Quest outside of the main game. This is a roguelike game in which the levels are randomized and the player has to make many decisions along the way which impact how the levels evolve.

## Game Overview
The game is split into three Acts. Each act is split into a series of events which fall into one of the following types:

1. Arenas (standard battles)
2. Elite Arenas (challenging battles with enhanced rewards)
3. Shop (where points are cashed in for new powers and improvements)
4. Cat Bed (rest area where either healing or enhancing Koshi's weapons is done)
5. Cat Toy (toy containing a treasure inside, essentially a "treasure chest")
6. Boss (end of Act boss battle)

The player has to navigate a randomized series of events of type 1-5 before an event of type 6 marks the completion of the act. Once all 3 acts are completed, the game is over and the player wins. If the player dies, the game is over.

A key feature of this is the random nature of the game. The specifics of how the events are situated and what each event contains are random. A random seed will be generated which determines all of the randomness required for generating all three acts. This seed can be saved and reused if the player wishes to try again.

## Player Profile
The player has many attributes and data associated to their run which evolves throughout the game and the decision-making process.

1. **Bricks:** The specific bricks which make up the arena. This includes any and all brick properties, sizes, colors, etc.
2. **Weapons:** A list of weapons which are shuffled and then spawned in order. This weapon list can include redundancies and it will reshuffle and cycle through if all weapons have been spawned.
3. **Items:** Similar to weapons, a list of items are shuffled and then spawned in an identical manner.
4. **Soccer Balls:** Similar to weapons, a list of soccer balls are shuffled and then spawned in an identical manner.
5. **Powers:** These are abilities acquired through battle which persist throughout the remainder of the run. This includes things like shields, increased speed of weapon recharge, etc.
6. **Attributes:** These are base attributes for certain game elements. For example, total life (3 hearts at start), time to spawn in between each of weapons, items, soccer balls (3 separate speeds). These may be adjusted from their initial value through powers.

The initial states of these are:
1. **Bricks:** All bricks are unmerged, green steering bricks with no other attributes
2. **Weapons:** Weapons are 3 wood swords
3. **Items:** No items at the start
4. **Soccer Balls:** 3 normal sized, non-explosive soccer balls
5. **Powers:** None at start
6. **Attributes:** 3 hearts and timing for new weapons, items, and soccer balls are 15 seconds, 20 seconds, and 30 seconds respectively.

## Spells
At the end of a level, the player is presented with a selection of random spells for which one must be selected. These spells may impact any of the 5 player profile elements. These are randomly selected from a large pool of potential spells.

Spells have a rarity ranking:
1. **Common:** These are less impactful and more commonly occurring
2. **Uncommon:** These are more impactful and less commonly occurring
3. **Rare:** These are very impactful and very infrequently occurring

Additionally, spells come in two flavors:
1. **Pawsitive:** These are intendend to benefit the player in some way
2. **Pawful:** These are intended to negatively impact the player in some way

A  spell selection would consist of:
1. 3 spells all of the same flavor and rarity
2. All 3 spells would either impact bricks or all three would not impact bricks (brick spell selections are differentiated).

A player may NOT skip any spell selection - one must always be picked.

An initial set of spells is listed in the spells.csv of this repo.

### Brick Spells
Brick spells which require a certain type of brick to be placed have some constraints on where they are to be placed. Brick attributes can be split into two different types:

1. **Type A:** Warped and Crumblers: These attributes can overlap (both can exist on the same brick) with one another as well as any other brick attribute of Type B.
2. **Type B:** All other attributes: Spawner, boost, slime, spike, barrier, turret, etc. Only ONE of these attributes may exist on a brick at a given time.

Any brick spell which is to assign a Type A attribute to a brick must be assigned to a brick without any Type A attribute currently. Similarly, any spell which is to assign a Type B attribute to a brick must be assigned to a brick without any Type B attribute currently. The only exception occurs when all bricks in the arena have a Type A or Type B attribute already - this is the only time brick attributes may be "overwritten". This rule ensure brick spells will eventually impact larger portions of the arena.

## Events

### Cat Bed
A cat bed gives koshi two choices:
1. **Heal:** Recover to full health
2. **Smith:** Add +2 strikes to any weapon in your weapon list

Weapons are the same as those in the full game. They are colored based on how many strikes they have remaining, with the same conventions. As a weapon is upgraded, it will change color/type to match the number of strikes available once it reaches the corresponding threshold.

For example, a wood sword (1 strike) smiths to a bronze sword (3 strikes) which itself smiths to a silver sword (5 strikes).

### Cat Toy
A cat toy is simply a pawsitive rare spell.

### Shop
At the end of any level, the total food points, enemy points, and soccer goal points acquired is converted into gold which can be used at the shop. The gold is calculated from the following formula:

Gold = [Food Points] + 10*[Enemy Points] + 25*[Soccer Points]

The shop will include the following items for sale, all of which are pawsitive:
1. One rare spell
2. Three uncommon spells
3. Five common spells

Prices for each spell will be randomly selected based on a distribution for each rarity type:
1. Rare = Price from 150 to 200
2. Uncommon = Price from 80 to 120
3. Common = Price from 40 to 70

### Arenas
These will be battle which take place in the brick arena set by the player profile.

1. Enemies will be randomly selected and placed. The enemies to appear in the level will be shared at the event selection screen prior to entering the arena so that they player at least knows what types of enemies will be encountered.
2. Level objectives can vary from enemy point objectives, food point objectives, and soccer point objectives. No levels will be of objective "survive until the clock runs out".
3. Enemy point objectives should occur 60% of the time, food point 30% of the time, and soccer point 10% of the time.
4. If at the start of the level with a soccer objective, the player does not have a goal brick yet, the player is then forced to play the spell to "Convert one brick into a soccer goal".
5. If Lovebugs are randomly selected enemies and the player does not have any barrier bricks in their profile, the player is then forced to play the spell to "Convert one brick into a barrier brick."

If the player is victorious, the player is presented with two sets of spells:
1. A set of 3 Pawful brick spells (all of the same random rarity)
2. A set of 3 spells of the same random flavor and same random rarity (but varying over all spell types of items, weapons, bricks, powers, soccer)

### Elite Arenas
These will not be implemented yet in the first version of the roguelike.

### Boss Battles
All boss battles will simply be Tom the Toaster in his level 2-25 (official game) arena for now.

