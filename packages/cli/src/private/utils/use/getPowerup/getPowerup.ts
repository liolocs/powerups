import { Instructions } from "@liolocs/powerups-sdk";

export default async function getPowerup(powerupName: string): Promise<{ instructions: Instructions}> {
  /**
   * should should for the powerup:
   * 1. locally: .powerups/installed/_internal, .powerups/installed/.npm, .powerups/installed/.git folders
   * 2. globally: ~/.powerups/installed/_internal, ~/.powerups/installed/.npm, ~/.powerups/installed/.git folders
   */
  // await searchForPowerupLocally();
}

// function searchForPowerupLocally(): Promise<void> {
//   return 
// }