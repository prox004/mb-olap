import time
import subprocess
import os
import sys
import psutil

def profile_run():
    # Start timer
    start_time = time.time()
    
    py_executable = sys.executable
    process = subprocess.Popen([py_executable, 'scripts/ingest_data.py'])
    
    # Profile memory
    p = psutil.Process(process.pid)
    peak_mem = 0
    
    while process.poll() is None:
        try:
            mem_info = p.memory_info()
            rss = mem_info.rss
            if rss > peak_mem:
                peak_mem = rss
        except psutil.NoSuchProcess:
            break
        time.sleep(0.05)
        
    end_time = time.time()
    elapsed = end_time - start_time
    peak_mem_mb = peak_mem / (1024 * 1024)
    
    print(f"Execution Status: {'Success' if process.returncode == 0 else 'Failed'}")
    print(f"Elapsed Time: {elapsed:.2f} seconds")
    print(f"Peak Memory: {peak_mem_mb:.2f} MB")
    
if __name__ == '__main__':
    profile_run()
