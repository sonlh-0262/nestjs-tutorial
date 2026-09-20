import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AttachableType = 'User';

@Entity('attachments')
@Index('IDX_attachments_attachable', ['attachableType', 'attachableId'])
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'attachable_type', type: 'varchar', length: 50 })
  attachableType: AttachableType;

  @Column({ name: 'attachable_id', type: 'uuid' })
  attachableId: string;

  @Column({ type: 'varchar', length: 512 })
  url: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_type', type: 'varchar', length: 100 })
  fileType: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize: number;

  @Column({ name: 'storage_path', type: 'varchar', length: 512 })
  storagePath: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
