import os
import shutil

SRC_DIR = 'src'
BACKUP_DIR = 'src_backup'

def restore_src():
    if not os.path.exists(BACKUP_DIR):
        print(f"Error: Backup directory {BACKUP_DIR} not found. Cannot restore.")
        return False
    
    if os.path.exists(SRC_DIR):
        print(f"Removing modified {SRC_DIR}...")
        try:
            shutil.rmtree(SRC_DIR)
        except Exception as e:
            print(f"Error removing {SRC_DIR}: {e}")
            return False

    print(f"Restoring {BACKUP_DIR} to {SRC_DIR}...")
    try:
        shutil.move(BACKUP_DIR, SRC_DIR)
        print("✅ Restoration successful! Your code is back to normal.")
        return True
    except Exception as e:
        print(f"Error restoring backup: {e}")
        return False

if __name__ == '__main__':
    confirm = input("Are you sure you want to restore 'src' from 'src_backup'? This will delete current 'src'. (y/n): ")
    if confirm.lower() == 'y':
        restore_src()
    else:
        print("Restoration cancelled.")
