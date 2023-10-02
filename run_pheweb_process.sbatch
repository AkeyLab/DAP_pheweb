#!/bin/bash
#SBATCH --job-name=process       # create a short name for your job
#SBATCH --nodes=1                # node count
#SBATCH --ntasks=1               # total number of tasks across all nodes
#SBATCH --cpus-per-task=8        # cpu-cores per task (>1 if multi-threaded tasks)
#SBATCH --mem=8G                # memory per cpu-core
#SBATCH --time=5:00:00          # total run time limit (HH:MM:SS)

source /scratch/gpfs/AKEY/rbierman/DAP/DAP_pheweb/.venv/bin/activate

pheweb process

