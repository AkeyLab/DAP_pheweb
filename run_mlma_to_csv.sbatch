#!/bin/bash
#SBATCH --job-name=conv          # create a short name for your job
#SBATCH --nodes=1                # node count
#SBATCH --ntasks=1               # total number of tasks across all nodes
#SBATCH --cpus-per-task=1        # cpu-cores per task (>1 if multi-threaded tasks)
#SBATCH --mem=10G                # memory per cpu-core
#SBATCH --time=02:00:00          # total run time limit (HH:MM:SS)
#SBATCH --array=1-68             # array'd jobs

P=`head -n $SLURM_ARRAY_TASK_ID mlma_paths.txt | tail -n 1`
~/base_venv/bin/python mlma_to_csv.py $P

