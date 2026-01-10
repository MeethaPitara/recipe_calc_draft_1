import os
import shutil
import re

SRC_DIR = 'src'
BACKUP_DIR = 'src_backup'

def backup_src():
    if os.path.exists(BACKUP_DIR):
        print(f"Backup directory {BACKUP_DIR} already exists. Aborting to prevent overwriting backup.")
        return False
    try:
        shutil.copytree(SRC_DIR, BACKUP_DIR)
        print(f"Successfully backed up {SRC_DIR} to {BACKUP_DIR}")
        return True
    except Exception as e:
        print(f"Backup failed: {e}")
        return False

def inject_ts_js(content, filename):
    # Pattern 1: Standard Function
    # function x() {
    content = re.sub(
        r'(function\s+\w+\s*\(.*?\)\s*\{)',
        lambda m: f'{m.group(1)}\n  console.log("📍 [{filename}] :: [{m.group(1).split("(")[0].replace("function ","").strip()}] called");',
        content
    )
    
    # Pattern 2: Arrow Function with block
    # const x = () => {
    # export const x = () => {
    content = re.sub(
        r'(const\s+(\w+)\s*=\s*.*?=>\s*\{)',
        lambda m: f'{m.group(1)}\n  console.log("📍 [{filename}] :: [{m.group(2)}] called");',
        content
    )

    # Note: Skipping implicit returns for safety as per plan
    return content

def inject_python(content, filename):
    # Pattern: def x():
    def replace_python_func(match):
        func_def = match.group(0)
        func_name = match.group(1)
        indentation = match.group(2) # Capture newline and indentation of the next line if possible, but regex is tricky line-by-line.
        
        # A safer way for python is to look for the colon, then insert a print on the next line 
        # with assumed indentation (4 spaces) relative to the def? 
        # Or just append the print statement after the colon with a newline and 4 spaces + def indentation.
        
        # Simple heuristic: assume standard 4 space indent or detect from next line?
        # Let's try to just insert standard indentation + 4 spaces
        
        return f'{func_def}\n    print(f"📍 [{filename}] :: [{func_name}] called")'

    # This regex matches the def line. \s* handles potential async def etc.
    # We aren't capturing indentation perfectly here, which is risky in Python.
    # Better approach: Read line by line.
    
    lines = content.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        new_lines.append(line)
        match = re.search(r'^\s*(?:async\s+)?def\s+(\w+)\s*\(', line)
        if match and line.strip().endswith(':'):
            # Calculate indentation for the print statement
            current_indent = len(line) - len(line.lstrip())
            next_indent = current_indent + 4
            indent_str = ' ' * next_indent
            func_name = match.group(1)
            new_lines.append(f'{indent_str}print(f"📍 [{filename}] :: [{func_name}] called")')
            
    return '\n'.join(new_lines)


def process_files():
    for root, dirs, files in os.walk(SRC_DIR):
        for file in files:
            file_path = os.path.join(root, file)
            filename = os.path.basename(file)
            ext = os.path.splitext(file)[1]
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = None
                if ext in ['.ts', '.tsx', '.js', '.jsx']:
                    new_content = inject_ts_js(content, filename)
                elif ext == '.py':
                    new_content = inject_python(content, filename)
                
                if new_content and new_content != content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Injected logs into {file_path}")
                    
            except Exception as e:
                print(f"Failed to process {file_path}: {e}")

if __name__ == '__main__':
    print("Starting Global X-Ray Injection...")
    if backup_src():
        process_files()
        print("Injection complete.")
    else:
        print("Skipping injection due to backup failure.")
