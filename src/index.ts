import sharp from "sharp";
import fs from "fs";
const readline = require('readline');

function askQuestion(question: string) : Promise<string> {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise<string>((resolve) => { rl.question(question, (answer) => { rl.close(); resolve(answer); }); });
}

interface Tile {
        name: string;
        tile_blob: Buffer;
        coordinates: { x: number, y: number };
        is_wall: boolean;
        is_transition: boolean;
}

async function createTileset() {
    let tileset : Tile[] = [] // Array of all tiles in the tileset
    let known_tile_types : {} = {} // Map known tile types to their IDs

    // Check if tile_dictionary.json exists, if so preload known_tile_types
        fs.access('tile_dictionary.json', fs.constants.F_OK, (err) => {
                if (err) {
                        console.log('tile_dictionary.json not found. Starting from scratch.');
                } else {
                        console.log('Loading known tile types from tile_dictionary.json.');
                        known_tile_types = JSON.parse(fs.readFileSync('tile_dictionary.json', 'utf8'));
                }
        });

    const input_file_path : string = "tileset_in.png"
    const tile_height = 48
    const tile_width = 48
    const full_map = await sharp(input_file_path);
    const full_map_info = await full_map.metadata();
    const full_map_width = full_map_info.width;
    const full_map_height = full_map_info.height;

    // Determine the number of tiles in the map
    const tile_count_x = Math.floor(full_map_width / tile_width);
    const tile_count_y = Math.floor(full_map_height / tile_height);

    console.log(`Creating tileset with ${tile_count_x} x ${tile_count_y} tiles.`);
    let total_progress = 0;
    let current_tile_index_x = 0;
    while (current_tile_index_x < tile_count_x) {
        let current_tile_index_y = 0;
        while (current_tile_index_y < tile_count_y) {
                fs.writeFile('tile_dictionary.json', JSON.stringify(known_tile_types), err=> {
                        if (err) console.error(err);
                        return;
                });

                const tile_x = current_tile_index_x * tile_width;
                const tile_y = current_tile_index_y * tile_height;


                console.log(`Total Progress: ${(total_progress / (tile_count_x * tile_count_y)) * 100}`);
                let tile : sharp.Sharp = null;
                try {
                        tile = await sharp(input_file_path).extract({ left: tile_x+1, top: tile_y+1, width: tile_width, height: tile_height });
                } catch (error) {
                        console.error(`Error processing tile at coordinates: (${current_tile_index_x},${current_tile_index_y}). Pixel Position: ${tile_x}, ${tile_y}.`, error);
                        total_progress++;
                        continue;
                }
                
                const { channels, dominant } = await sharp(await tile.toBuffer()).stats();
                const [ r_avg, g_avg, b_avg ] = channels.map(c => c.mean);
                let channel_avg = r_avg + g_avg + b_avg;
          
    
                    // Create a new tile object
                    let new_tile : Tile = {
                            name: undefined,
                            tile_blob: await tile.toBuffer(),
                            coordinates: { x: tile_x, y: tile_y },
                            is_wall: false,
                            is_transition: false
                    }

                // Round the channel average to the nearest whole number
                channel_avg = Math.round(channel_avg);

                // Check if known_tile_types contains channel_avg within a bound of +/- 5 points
                let doesExist = false;
                let channel_offset = 0;
                for (let i = 0; i <= 3; i++) {
                        if (known_tile_types[channel_avg + i] !== undefined) {
                                doesExist = true;
                                channel_offset = i;
                                break;
                        }
                        if (known_tile_types[channel_avg - i] !== undefined) {
                                doesExist = true;
                                channel_offset = -i;
                                break;
                        }
                }
    
                // If channel average is not a key in known_tile_types, add it
                if (!doesExist) {
                    console.log(`Processing tile at coordinates: (${current_tile_index_x},${current_tile_index_y}). Pixel Position: ${tile_x}, ${tile_y}.`);

                    // Prompt the user to enter a name for the new tile type
                    console.log(`Creating new tile type with average color ${channel_avg}.`);
                    await tile.toFile(`${current_tile_index_x}_${current_tile_index_y}_tile.png`);
                    console.log(`Creating file for reference: ${current_tile_index_x}_${current_tile_index_y}_tile.png`);

    
                    const tile_type = await askQuestion("Enter a name for the new tile type: ");
                    const tile_isTransition = await askQuestion("Is this a transition tile? (yes/no): ") === "yes";
                    const tile_isWall = await askQuestion("Is this a wall tile? (yes/no): ") === "yes";
    
                    new_tile.name = tile_type;
                    new_tile.is_wall = tile_isWall;
                    new_tile.is_transition = tile_isTransition;
    
                    known_tile_types[channel_avg] = { "name": new_tile.name, "is_transition": new_tile.is_transition, "is_wall": new_tile.is_wall  };
                } else {

                    // If channel average is a key in known_tile_types, use the existing tile type
                    new_tile.name = known_tile_types[channel_avg + channel_offset].name;
                    new_tile.is_transition = known_tile_types[channel_avg + channel_offset].is_transition;
                    new_tile.is_wall = known_tile_types[channel_avg + channel_offset].is_wall;
                }
                
                    // Write the tile to the tileset array
                    tileset.push(new_tile);
                    current_tile_index_y++;
                    total_progress++;
                }
                current_tile_index_x++;
        }

        console.log("Tileset creation complete.");
        fs.writeFile('tileset.json', JSON.stringify(tileset), err=> {
                if (err) console.error(err);
                return;
        });
    }



createTileset();