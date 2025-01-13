import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import Phaser from 'phaser';
import { MainScene } from './scenes/main.scene';
import { GameConfigService } from '../services/game.config.service';
@Component({
  selector: 'app-game',
  standalone: true,
  imports: [],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent implements OnInit{
  @ViewChild('gameContainer', {static: true}) gameContainer!: ElementRef;

  game!: Phaser.Game;

  constructor(private gameConfig: GameConfigService) {}


  ngOnInit(): void {
    const config = this.gameConfig.getConfig(this.gameContainer.nativeElement)
    this.game = new Phaser.Game(config);
  }
}
