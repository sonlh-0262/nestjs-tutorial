import { ApiProperty } from '@nestjs/swagger';

export class HelloResponseDto {
  @ApiProperty({
    description: 'Greeting rendered in the resolved language.',
    example: 'Hello World!',
  })
  message: string;

  @ApiProperty({
    description: 'Language actually used to render the message.',
    example: 'en',
  })
  language: string;
}
