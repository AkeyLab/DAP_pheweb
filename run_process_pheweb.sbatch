#!/bin/bash
#SBATCH --job-name=process_pheweb                               # create a short name for your job
#SBATCH --nodes=1                                               # node count, pretty much always 1
#SBATCH --ntasks=1                                              # total number of tasks across all nodes. also 1
#SBATCH --cpus-per-task=8                                       # cpu-cores per task (equal to $SLURM_CPUS_PER_TASK)
#SBATCH -q public                                               # mainly keep as public, can use debug for testing
#SBATCH -p general                                              # general partition, use htc for jobs shorter than 4 hours
#SBATCH --mem=20G                                               # total cpu requested memory
#SBATCH --time=24:00:00                                         # total run time limit (HH:MM:SS)
#SBATCH --output=slurm_outs/process_pheweb_slurm-%j.out         # for non-array job, where to store and what to name slurm outs

#bash strict mode
set -euo pipefail

/scratch/rbierma1/DAP_pheweb_20240719/pheweb_env/bin/pheweb process

