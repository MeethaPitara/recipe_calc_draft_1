import os
import sys

def list_files(startpath):
    output_file = 'project_structure.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"Project Structure for: {os.path.abspath(startpath)}\n")
        f.write("==================================================\n\n")
        
        for root, dirs, files in os.walk(startpath):
            # Exclude directories
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', '.idea', '.vscode', '.next', 'build', 'coverage']]
            
            level = root.replace(startpath, '').count(os.sep)
            indent = ' ' * 4 * (level)
            f.write('{}{}/\n'.format(indent, os.path.basename(root)))
            subindent = ' ' * 4 * (level + 1)
            for file in files:
                if file == 'project_structure.txt' or file == 'generate_tree.py':
                    continue
                f.write('{}{}\n'.format(subindent, file))
    print(f"Tree structure saved to {output_file}")

if __name__ == "__main__":
    list_files('.')
