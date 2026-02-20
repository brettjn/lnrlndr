#!/usr/bin/env python3
"""
Lunar Lander - A classic vector graphics arcade game clone
Control the Apollo Lunar Module to safely land on the moon's surface
"""

import pygame
import math
import random
from typing import List, Tuple

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# Colors (vector graphics style - green on black like classic arcade)
BLACK = (0, 0, 0)
GREEN = (0, 255, 0)
YELLOW = (255, 255, 0)
RED = (255, 0, 0)
WHITE = (255, 255, 255)

# Physics constants
GRAVITY = 0.05
MAX_THRUST = 0.15
THRUST_STEP = 0.01
ROTATION_SPEED = 3.0
MAX_LANDING_VELOCITY = 2.0
MAX_LANDING_ANGLE = 15.0

# Fuel constants
INITIAL_FUEL = 500
FUEL_CONSUMPTION_RATE = 0.5


class Lander:
    """Apollo Lunar Module with physics simulation"""
    
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.vx = 0.0  # Velocity X
        self.vy = 0.0  # Velocity Y
        self.angle = 0.0  # Angle in degrees (0 = pointing up)
        self.thrust = 0.0
        self.fuel = INITIAL_FUEL
        self.crashed = False
        self.landed = False
        self.size = 15
        
    def get_shape(self) -> List[Tuple[float, float]]:
        """Return the Apollo LM shape as a list of points (vector graphics)"""
        # Apollo Lunar Module shape (simplified)
        rad = math.radians(self.angle)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        
        # Define shape relative to center (0, 0)
        shape = [
            (0, -12),      # Top point
            (-8, 0),       # Left middle
            (-10, 8),      # Left leg
            (-5, 8),       # Left leg inner
            (0, 3),        # Bottom center
            (5, 8),        # Right leg inner
            (10, 8),       # Right leg
            (8, 0),        # Right middle
        ]
        
        # Rotate and translate points
        rotated = []
        for px, py in shape:
            rx = px * cos_a - py * sin_a
            ry = px * sin_a + py * cos_a
            rotated.append((self.x + rx, self.y + ry))
        
        return rotated
    
    def get_thruster_points(self) -> List[Tuple[float, float]]:
        """Return flame points when thrusting"""
        if self.thrust <= 0 or self.fuel <= 0:
            return []
        
        rad = math.radians(self.angle)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        
        # Flame size based on thrust level
        flame_length = 10 + (self.thrust / MAX_THRUST) * 20
        
        # Flame shape (triangle)
        flame = [
            (-3, 8),
            (0, 8 + flame_length),
            (3, 8),
        ]
        
        # Rotate and translate
        rotated = []
        for px, py in flame:
            rx = px * cos_a - py * sin_a
            ry = px * sin_a + py * cos_a
            rotated.append((self.x + rx, self.y + ry))
        
        return rotated
    
    def rotate_left(self):
        """Rotate lander counter-clockwise"""
        self.angle -= ROTATION_SPEED
        if self.angle < 0:
            self.angle += 360
    
    def rotate_right(self):
        """Rotate lander clockwise"""
        self.angle += ROTATION_SPEED
        if self.angle >= 360:
            self.angle -= 360
    
    def increase_thrust(self):
        """Increase thrust level"""
        if self.fuel > 0:
            self.thrust = min(self.thrust + THRUST_STEP, MAX_THRUST)
    
    def decrease_thrust(self):
        """Decrease thrust level"""
        self.thrust = max(self.thrust - THRUST_STEP, 0)
    
    def update(self, terrain: 'Terrain'):
        """Update lander physics"""
        if self.crashed or self.landed:
            return
        
        # Apply gravity
        self.vy += GRAVITY
        
        # Apply thrust if fuel available
        if self.thrust > 0 and self.fuel > 0:
            rad = math.radians(self.angle)
            self.vx -= self.thrust * math.sin(rad)
            self.vy -= self.thrust * math.cos(rad)
            self.fuel -= self.thrust * FUEL_CONSUMPTION_RATE
            if self.fuel < 0:
                self.fuel = 0
        
        # Update position
        self.x += self.vx
        self.y += self.vy
        
        # Check boundaries (wrap horizontally)
        if self.x < 0:
            self.x = SCREEN_WIDTH
        elif self.x > SCREEN_WIDTH:
            self.x = 0
        
        # Check collision with terrain
        if self.y >= SCREEN_HEIGHT - 20:  # Basic ground check
            self.check_landing(terrain)
        
        # Check if crashed (off screen bottom)
        if self.y > SCREEN_HEIGHT + 50:
            self.crashed = True
    
    def check_landing(self, terrain: 'Terrain'):
        """Check if landing is successful or a crash"""
        # Get landing pad info
        landing_zone = terrain.get_landing_zone()
        
        # Check if over landing pad
        if landing_zone[0] <= self.x <= landing_zone[1]:
            # Check velocity and angle
            velocity = math.sqrt(self.vx ** 2 + self.vy ** 2)
            angle_normalized = self.angle if self.angle <= 180 else self.angle - 360
            
            if velocity <= MAX_LANDING_VELOCITY and abs(angle_normalized) <= MAX_LANDING_ANGLE:
                self.landed = True
                self.vy = 0
                self.vx = 0
                self.y = SCREEN_HEIGHT - 30
            else:
                self.crashed = True
        else:
            self.crashed = True
    
    def draw(self, screen: pygame.Surface):
        """Draw the lander"""
        if self.crashed:
            # Draw explosion/crash
            points = self.get_shape()
            for point in points:
                pygame.draw.circle(screen, RED, (int(point[0]), int(point[1])), 2)
        else:
            # Draw lander body
            points = self.get_shape()
            pygame.draw.polygon(screen, GREEN, points, 2)
            
            # Draw thrust flame
            if self.thrust > 0 and self.fuel > 0:
                flame_points = self.get_thruster_points()
                if flame_points:
                    pygame.draw.polygon(screen, YELLOW, flame_points, 0)


class Terrain:
    """Mountainous terrain with landing pad"""
    
    def __init__(self):
        self.points = []
        self.landing_pad_x = 0
        self.landing_pad_width = 80
        self.generate()
    
    def generate(self):
        """Generate random mountainous terrain"""
        self.points = []
        
        # Randomly place landing pad
        self.landing_pad_x = random.randint(150, SCREEN_WIDTH - 150)
        
        # Generate terrain points
        num_points = 20
        for i in range(num_points + 1):
            x = (SCREEN_WIDTH / num_points) * i
            
            # Flat landing pad area
            if self.landing_pad_x <= x <= self.landing_pad_x + self.landing_pad_width:
                y = SCREEN_HEIGHT - 20
            else:
                # Random mountainous terrain
                y = SCREEN_HEIGHT - random.randint(20, 150)
            
            self.points.append((x, y))
    
    def get_landing_zone(self) -> Tuple[float, float]:
        """Return the x coordinates of the landing pad"""
        return (self.landing_pad_x, self.landing_pad_x + self.landing_pad_width)
    
    def draw(self, screen: pygame.Surface):
        """Draw the terrain"""
        if len(self.points) < 2:
            return
        
        # Draw terrain lines
        for i in range(len(self.points) - 1):
            color = GREEN
            # Highlight landing pad
            if self.landing_pad_x <= self.points[i][0] <= self.landing_pad_x + self.landing_pad_width:
                color = WHITE
            pygame.draw.line(screen, color, self.points[i], self.points[i + 1], 2)


class Game:
    """Main game class"""
    
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Lunar Lander")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.small_font = pygame.font.Font(None, 24)
        self.running = True
        self.game_state = "playing"  # playing, landed, crashed
        
        self.lander = Lander(SCREEN_WIDTH // 2, 50)
        self.terrain = Terrain()
    
    def handle_events(self):
        """Handle input events"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            
            # Mouse wheel for thrust control
            elif event.type == pygame.MOUSEWHEEL:
                if event.y > 0:  # Scroll up
                    self.lander.increase_thrust()
                elif event.y < 0:  # Scroll down
                    self.lander.decrease_thrust()
            
            # Keyboard for restart
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r and self.game_state != "playing":
                    self.reset()
        
        # Continuous key presses for rotation
        keys = pygame.key.get_pressed()
        if self.game_state == "playing":
            if keys[pygame.K_LEFT]:
                self.lander.rotate_left()
            if keys[pygame.K_RIGHT]:
                self.lander.rotate_right()
    
    def update(self):
        """Update game state"""
        if self.game_state == "playing":
            self.lander.update(self.terrain)
            
            # Check game state changes
            if self.lander.crashed:
                self.game_state = "crashed"
            elif self.lander.landed:
                self.game_state = "landed"
    
    def draw(self):
        """Draw everything"""
        self.screen.fill(BLACK)
        
        # Draw terrain
        self.terrain.draw(self.screen)
        
        # Draw lander
        self.lander.draw(self.screen)
        
        # Draw HUD
        self.draw_hud()
        
        # Draw game state messages
        if self.game_state == "landed":
            self.draw_message("SUCCESSFUL LANDING!", GREEN)
            self.draw_restart_hint()
        elif self.game_state == "crashed":
            self.draw_message("CRASHED!", RED)
            self.draw_restart_hint()
        
        pygame.display.flip()
    
    def draw_hud(self):
        """Draw heads-up display"""
        # Altitude
        altitude = int(SCREEN_HEIGHT - self.lander.y)
        alt_text = self.small_font.render(f"ALT: {altitude}", True, GREEN)
        self.screen.blit(alt_text, (10, 10))
        
        # Velocity
        velocity = math.sqrt(self.lander.vx ** 2 + self.lander.vy ** 2)
        vel_text = self.small_font.render(f"VEL: {velocity:.1f}", True, GREEN)
        self.screen.blit(vel_text, (10, 35))
        
        # Fuel
        fuel_text = self.small_font.render(f"FUEL: {int(self.lander.fuel)}", True, GREEN)
        self.screen.blit(fuel_text, (10, 60))
        
        # Thrust level
        thrust_percent = int((self.lander.thrust / MAX_THRUST) * 100)
        thrust_text = self.small_font.render(f"THRUST: {thrust_percent}%", True, GREEN)
        self.screen.blit(thrust_text, (10, 85))
        
        # Angle
        angle_normalized = self.lander.angle if self.lander.angle <= 180 else self.lander.angle - 360
        angle_text = self.small_font.render(f"ANGLE: {angle_normalized:.0f}°", True, GREEN)
        self.screen.blit(angle_text, (10, 110))
        
        # Instructions
        inst_text = self.small_font.render("← → ROTATE | SCROLL THRUST", True, WHITE)
        self.screen.blit(inst_text, (SCREEN_WIDTH - 320, 10))
    
    def draw_message(self, text: str, color: Tuple[int, int, int]):
        """Draw centered message"""
        message = self.font.render(text, True, color)
        rect = message.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
        self.screen.blit(message, rect)
    
    def draw_restart_hint(self):
        """Draw restart instruction"""
        hint = self.small_font.render("Press R to restart", True, WHITE)
        rect = hint.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 40))
        self.screen.blit(hint, rect)
    
    def reset(self):
        """Reset game"""
        self.lander = Lander(SCREEN_WIDTH // 2, 50)
        self.terrain = Terrain()
        self.game_state = "playing"
    
    def run(self):
        """Main game loop"""
        while self.running:
            self.handle_events()
            self.update()
            self.draw()
            self.clock.tick(FPS)
        
        pygame.quit()


def main():
    """Entry point"""
    game = Game()
    game.run()


if __name__ == "__main__":
    main()
